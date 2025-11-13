"use client";
import { useState, useRef, useEffect } from "react";
import { ToolType, ApiRequestParams } from "../types";
import { fetchApi, imageToBase64 } from "../lib/api";

type ImageToolsProps = {
    mode?: "all" | "single";
    initialTool?: ToolType;
    className?: string;
};

const ImageTools = ({ mode = "all", initialTool, className }: ImageToolsProps) => {
    const [activeTool, setActiveTool] = useState<ToolType>(initialTool ?? ToolType.IMAGE_COMPRESS);
    const [inputValue, setInputValue] = useState("");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [result, setResult] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [imageResult, setImageResult] = useState<string | null>(null);
    const [showViewer, setShowViewer] = useState(false);
    const [compressQuality, setCompressQuality] = useState(0.7);
    const [maxPixel, setMaxPixel] = useState(1920);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (mode === "single" && initialTool) {
            setActiveTool(initialTool);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode, initialTool]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setShowViewer(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    // 切换工具：重置所有状态
    const handleToolChange = (tool: ToolType) => {
        setActiveTool(tool);
        setInputValue("");
        setSelectedFile(null);
        setResult("");
        setImageResult(null);
        setShowViewer(false);
        setCompressQuality(0.7);
        setMaxPixel(1920);
    };

    // 处理文件选择（修复：确保文件正确赋值）
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type.startsWith("image/")) {
            setSelectedFile(file);
            setImageResult(null);
            setResult("");
            // 清空input值，避免重复选择同一张图片无反应
            e.target.value = "";
        }
    };

    // 触发文件选择
    const triggerFileSelect = () => {
        fileInputRef.current?.click();
    };

    // 前端Canvas压缩图片（保持不变）
    const compressImageByCanvas = async (file: File): Promise<{ base64: string; size: number }> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";

            imageToBase64(file).then(base64 => {
                img.src = base64;

                img.onload = () => {
                    const canvas = document.createElement("canvas");
                    const ctx = canvas.getContext("2d");
                    if (!ctx) { reject(new Error("Canvas上下文获取失败")); return; }
                    const context = ctx as CanvasRenderingContext2D;

                    let targetWidth = img.width;
                    let targetHeight = img.height;
                    const scaleRatio = Math.min(1, maxPixel / targetWidth, maxPixel / targetHeight);

                    if (scaleRatio < 1) {
                        targetWidth = Math.round(targetWidth * scaleRatio);
                        targetHeight = Math.round(targetHeight * scaleRatio);
                    }

                    canvas.width = targetWidth;
                    canvas.height = targetHeight;

                    context.clearRect(0, 0, targetWidth, targetHeight);
                    context.drawImage(img, 0, 0, targetWidth, targetHeight);

                    canvas.toBlob(
                        (blob) => {
                            if (!blob) { reject(new Error("图片压缩失败")); return; }
                            const outBlob = blob as Blob;
                            imageToBase64(new File([outBlob], file.name, { type: outBlob.type }))
                              .then(compressedBase64 => {
                                resolve({ base64: compressedBase64, size: outBlob.size });
                              })
                              .catch(reject);
                        },
                        file.type || "image/jpeg",
                        compressQuality
                    );
                };

                img.onerror = () => reject(new Error("图片加载失败"));
            }).catch(err => reject(err));
        });
    };

    // 复制功能（保持不变）
    const copyImageUrl = (url: string) => {
        navigator.clipboard.writeText(url).then(() => {
            setResult("链接已复制到剪贴板！");
            setTimeout(() => {
                setResult(imageResult?.startsWith("data:image/") ? "图片Base64已复制" : `图片链接：${url}`);
            }, 2000);
        }).catch(() => {
            setResult("链接复制失败，请手动复制");
        });
    };

    // 新增：缺失的 buildRequestParams 函数（AI功能核心）
    const buildRequestParams = async (): Promise<ApiRequestParams> => {
        switch (activeTool) {
            // AI生图（文本输入）
            case ToolType.AI_GENERATE:
                if (!inputValue) throw new Error("请输入生图描述");
                return {
                    model: "deepseek-r1",
                    stream: true,
                    max_tokens: 1688,
                    temperature: 0.5,
                    messages: [{ role: "user", content: { type: "text", text: `生成图片：${inputValue}` } }],
                };

            // 图片识别（上传图片）
            case ToolType.IMAGE_RECOGNIZE:
                if (!selectedFile) throw new Error("请选择图片");
                const recognizeBase64 = await imageToBase64(selectedFile);
                return {
                    model: "gpt-4o",
                    stream: false,
                    max_tokens: 800,
                    messages: [
                        {
                            role: "user",
                            content: [
                                { type: "text", text: "分析这张图片，返回详细识别结果" },
                                { type: "image_url", image_url: { url: recognizeBase64 } },
                            ],
                        },
                    ],
                };

            // 抠图去背景（上传图片）
            case ToolType.BACKGROUND_REMOVE:
                if (!selectedFile) throw new Error("请选择图片");
                const bgRemoveBase64 = await imageToBase64(selectedFile);
                return {
                    model: "gemini-2.5-flash-image",
                    stream: false,
                    max_tokens: 800,
                    messages: [
                        {
                            role: "user",
                            content: [
                                { type: "text", text: "移除这张图片的背景，仅返回无背景图片的Base64或在线链接" },
                                { type: "image_url", image_url: { url: bgRemoveBase64 } },
                            ],
                        },
                    ],
                };

            default:
                throw new Error("未知工具类型");
        }
    };

    // 提交请求（保持不变，现在可调用 buildRequestParams）
    const handleSubmit = async () => {
        try {
            setLoading(true);
            setImageResult(null);

            // 图片压缩：前端Canvas处理
            if (activeTool === ToolType.IMAGE_COMPRESS) {
                if (!selectedFile) throw new Error("请选择图片");

                const compressedData = await compressImageByCanvas(selectedFile);
                const originalSize = selectedFile.size / 1024 / 1024;
                const compressedSize = compressedData.size / 1024 / 1024;
                const compressRatio = Math.round(((originalSize - compressedSize) / originalSize) * 100);

                setImageResult(compressedData.base64);
                setShowViewer(true);
                setResult(
                    `压缩成功！\n` +
                    `原始大小：${originalSize.toFixed(2)}MB\n` +
                    `压缩后大小：${compressedSize.toFixed(2)}MB\n` +
                    `压缩比例：${compressRatio}% | 质量：${(compressQuality * 100).toFixed(0)}%`
                );
                return;
            }

            // AI生图、识别、抠图：调用 buildRequestParams（现在已定义）
            const params = await buildRequestParams();
            const data = await fetchApi(params);

            if (params.stream) {
                const reader = data.getReader();
                const decoder = new TextDecoder();
                let resultText = "";
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    resultText += decoder.decode(value);
                    setResult(resultText);
                }
                const streamContent = resultText;
                const mdMatch = streamContent.match(/!\[.*?\]\((https?:\/\/[^\)]+)\)/);
                const directMatch = streamContent.match(/https?:\/\/[^\s)]+/);
                const dataMatch = streamContent.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+={0,2}/);
                const imageUrl = mdMatch?.[1] || directMatch?.[0] || dataMatch?.[0];
                if (imageUrl) {
                    setImageResult(imageUrl);
                    setShowViewer(true);
                }
            } else {
                const content = data.choices?.[0]?.message?.content || "";
                const imageUrlRegex = /!\[.*?\]\((https?:\/\/[^\)]+)\)/;
                const match = content.match(imageUrlRegex);

                if (match && match[1]) {
                    const imageUrl = match[1];
                    setImageResult(imageUrl);
                    setShowViewer(true);
                    setResult(`图片链接：${imageUrl}`);
                } else {
                    setResult("处理结果：" + content);
                }
            }
        } catch (error) {
            setResult(`❌ ${(error as Error).message}`);
        } finally {
            setLoading(false);
        }
    };

    const containerBase = mode === "all" ? "w-full max-w-4xl mx-auto" : "w-full";
    return (
        <div className={`${containerBase} p-6 glass-panel ${className ?? ""}`.trim()}>
            {/* 工具切换栏 */}
            {mode === "all" && (
                <div className="flex justify-center mb-6">
                    <div className="segmented">
                        {Object.values(ToolType).map((tool) => (
                            <button
                                key={tool}
                                className={`${activeTool === tool ? "active" : ""}`}
                                onClick={() => handleToolChange(tool)}
                            >
                                {tool === ToolType.IMAGE_COMPRESS && "图片压缩"}
                                {tool === ToolType.AI_GENERATE && "AI 生图"}
                                {tool === ToolType.IMAGE_RECOGNIZE && "图片识别"}
                                {tool === ToolType.BACKGROUND_REMOVE && "抠图去背景"}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* 输入区域 */}
            <div className="mb-6">
                {activeTool === ToolType.AI_GENERATE ? (
                    // AI 生图：文本输入
                    <div className="mb-4">
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder="输入生图描述（如：一只猫在草地上）"
                            className="ui-input mb-4"
                        />
                    </div>
                ) : (
                    // 其他工具：图片上传 + 压缩配置（修复：优化上传按钮样式和交互）
                    <div>
                        <label
                            onClick={triggerFileSelect}
                            className="btn-base btn-secondary mb-4 cursor-pointer"
                        >
                            选择图片
                        </label>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept="image/*"
                            className="hidden"
                        />
                        {selectedFile && (
                            <p className="text-sm mb-4 glass-panel px-3 py-2 inline-block">
                                已选择：{selectedFile.name} | 大小：{(selectedFile.size / 1024 / 1024).toFixed(2)}MB
                            </p>
                        )}

                        {/* 图片压缩专属配置 */}
                        {activeTool === ToolType.IMAGE_COMPRESS && (
                            <div className="mb-4 space-y-4 glass-panel p-4">
                                {/* 压缩质量调节 */}
                                <div>
                                    <label className="block mb-1 text-sm text-gray-600 font-medium">
                                        压缩质量：{Math.round(compressQuality * 100)}%
                                    </label>
                                    <input
                                        type="range"
                                        min="0.1"
                                        max="1"
                                        step="0.1"
                                        value={compressQuality}
                                        onChange={(e) => setCompressQuality(Number(e.target.value))}
                                        className="w-full accent-blue-500"
                                    />
                                </div>

                                {/* 最大像素调节 */}
                                <div>
                                    <label className="block mb-1 text-sm text-gray-600 font-medium">
                                        最大边长限制：{maxPixel}px（超过自动缩放）
                                    </label>
                                    <input
                                        type="range"
                                        min="320"
                                        max="4096"
                                        step="100"
                                        value={maxPixel}
                                        onChange={(e) => setMaxPixel(Number(e.target.value))}
                                        className="w-full accent-blue-500"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* 提交按钮 */}
                <button
                    onClick={handleSubmit}
                    className="btn-base btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed"
                    aria-busy={loading}
                    disabled={loading}
                >
                    {loading ? (
                        <span className="animate-pulse">处理中...</span>
                    ) : (
                        "开始处理"
                    )}
                </button>
            </div>

            {/* 结果展示 */}
            <div className="mt-6 p-6 glass-panel">
                <h3 className="text-xl font-semibold mb-2">处理结果</h3>
                {/* 渲染图片 */}
                {imageResult && (
                    <div className="mb-4 flex flex-col items-center gap-4">
                        <img
                            src={imageResult}
                            alt="处理后的图片"
                            className="max-w-full h-auto rounded-lg border cursor-zoom-in"
                            onClick={() => setShowViewer(true)}
                            style={{ maxHeight: "400px" }}
                        />
                        {/* 复制按钮 */}
                        <button
                            onClick={() => copyImageUrl(imageResult)}
                            className="btn-base btn-secondary text-sm"
                        >
                            {imageResult.startsWith("data:image/") ? "复制图片Base64" : "一键复制图片链接"}
                        </button>
                    </div>
                )}
                {/* 文本结果 */}
                <pre className="whitespace-pre-wrap text-sm">
                    {result}
                </pre>
            </div>

            {imageResult && showViewer && (
                <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4" onClick={() => setShowViewer(false)}>
                    <div className="glass-panel p-3 max-w-[92vw] max-h-[88vh]" onClick={(e) => e.stopPropagation()}>
                        <img
                            src={imageResult}
                            alt="处理后的图片预览"
                            className="max-w-full max-h-[72vh] object-contain rounded"
                        />
                        <div className="mt-3 flex justify-end gap-2">
                            <button
                                onClick={() => copyImageUrl(imageResult)}
                                className="btn-base btn-secondary text-sm"
                            >
                                {imageResult.startsWith("data:image/") ? "复制图片Base64" : "复制图片链接"}
                            </button>
                            <a href={imageResult} download className="btn-base btn-primary text-sm">下载图片</a>
                            <button onClick={() => setShowViewer(false)} className="btn-base btn-secondary text-sm">关闭</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ImageTools;