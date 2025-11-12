"use client";
import { useState, useRef } from "react";
import { ToolType, ApiRequestParams } from "../types";
import { fetchApi, imageToBase64 } from "../lib/api";

const ImageTools = () => {
    const [activeTool, setActiveTool] = useState<ToolType>(ToolType.IMAGE_COMPRESS);
    const [inputValue, setInputValue] = useState("");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [result, setResult] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [imageResult, setImageResult] = useState<string | null>(null);
    const [compressQuality, setCompressQuality] = useState(0.7);
    const [maxPixel, setMaxPixel] = useState(1920);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 切换工具：重置所有状态
    const handleToolChange = (tool: ToolType) => {
        setActiveTool(tool);
        setInputValue("");
        setSelectedFile(null);
        setResult("");
        setImageResult(null);
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
                    if (!ctx) reject(new Error("Canvas上下文获取失败"));

                    let targetWidth = img.width;
                    let targetHeight = img.height;
                    const scaleRatio = Math.min(1, maxPixel / targetWidth, maxPixel / targetHeight);

                    if (scaleRatio < 1) {
                        targetWidth = Math.round(targetWidth * scaleRatio);
                        targetHeight = Math.round(targetHeight * scaleRatio);
                    }

                    canvas.width = targetWidth;
                    canvas.height = targetHeight;

                    ctx.clearRect(0, 0, targetWidth, targetHeight);
                    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

                    canvas.toBlob(
                        (blob) => {
                            if (!blob) reject(new Error("图片压缩失败"));
                            imageToBase64(new File([blob], file.name, { type: blob.type })).then(compressedBase64 => {
                                resolve({ base64: compressedBase64, size: blob.size });
                            });
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
                    messages: [{ role: "user", content: `生成图片：${inputValue}` }],
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
                setResult(
                    `压缩成功！\n` +
                    `原始尺寸：${selectedFile.width || "未知"}x${selectedFile.height || "未知"}px | 大小：${originalSize.toFixed(2)}MB\n` +
                    `压缩后尺寸：${compressedData.base64.match(/width="(\d+)"/)?.[1] || "未知"}x${compressedData.base64.match(/height="(\d+)"/)?.[1] || "未知"}px | 大小：${compressedSize.toFixed(2)}MB\n` +
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
            } else {
                const content = data.choices?.[0]?.message?.content || "";
                const imageUrlRegex = /!\[.*?\]\((https?:\/\/[^\)]+)\)/;
                const match = content.match(imageUrlRegex);

                if (match && match[1]) {
                    const imageUrl = match[1];
                    setImageResult(imageUrl);
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

    return (
        <div className="w-full max-w-4xl mx-auto p-6 bg-gradient-to-r from-blue-200 to-purple-300 rounded-xl shadow-lg">
            {/* 工具切换栏 */}
            <div className="flex flex-wrap gap-4 mb-6 justify-center">
                {Object.values(ToolType).map((tool) => (
                    <button
                        key={tool}
                        className={`px-6 py-3 rounded-lg transition duration-300 ease-in-out transform ${
                            activeTool === tool
                                ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white"
                                : "bg-gray-200 hover:bg-gray-300"
                        }`}
                        onClick={() => handleToolChange(tool)}
                    >
                        {tool === ToolType.IMAGE_COMPRESS && "图片压缩"}
                        {tool === ToolType.AI_GENERATE && "AI 生图"}
                        {tool === ToolType.IMAGE_RECOGNIZE && "图片识别"}
                        {tool === ToolType.BACKGROUND_REMOVE && "抠图去背景"}
                    </button>
                ))}
            </div>

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
                            className="w-full p-4 text-lg rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                        />
                    </div>
                ) : (
                    // 其他工具：图片上传 + 压缩配置（修复：优化上传按钮样式和交互）
                    <div>
                        <label
                            onClick={triggerFileSelect}
                            className="inline-block px-6 py-3 bg-gray-300 hover:bg-gray-400 rounded-lg mb-4 shadow-md transition duration-200 cursor-pointer"
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
                            <p className="text-sm text-gray-600 mb-4 bg-white px-3 py-2 rounded-md inline-block">
                                已选择：{selectedFile.name} | 大小：{(selectedFile.size / 1024 / 1024).toFixed(2)}MB
                            </p>
                        )}

                        {/* 图片压缩专属配置 */}
                        {activeTool === ToolType.IMAGE_COMPRESS && (
                            <div className="mb-4 space-y-4 bg-white p-4 rounded-lg">
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
                    className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg transition duration-200 hover:scale-105 font-medium"
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
            <div className="mt-6 p-6 border rounded-lg bg-gray-50 shadow-lg">
                <h3 className="text-xl font-semibold mb-2">处理结果</h3>
                {/* 渲染图片 */}
                {imageResult && (
                    <div className="mb-4 flex flex-col items-center gap-4">
                        <img
                            src={imageResult}
                            alt="处理后的图片"
                            className="max-w-full h-auto rounded-lg border-4 border-indigo-200 shadow-lg"
                            style={{ maxHeight: "400px" }}
                        />
                        {/* 复制按钮 */}
                        <button
                            onClick={() => copyImageUrl(imageResult)}
                            className="px-4 py-2 bg-gray-300 text-sm rounded-lg hover:bg-gray-400 transition duration-200"
                        >
                            {imageResult.startsWith("data:image/") ? "复制图片Base64" : "一键复制图片链接"}
                        </button>
                    </div>
                )}
                {/* 文本结果 */}
                <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-white p-3 rounded-md border border-gray-200">
                    {result}
                </pre>
            </div>
        </div>
    );
};

export default ImageTools;