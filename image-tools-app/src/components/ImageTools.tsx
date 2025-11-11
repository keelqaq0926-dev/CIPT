"use client"; // 关键：添加这一行，标记为客户端组件
import { useState, useRef } from "react";
import { ToolType, ApiRequestParams } from "../types";
import { fetchApi, imageToBase64 } from "../lib/api"; // 移除AI压缩依赖，保留imageToBase64

const ImageTools = () => {
    const [activeTool, setActiveTool] = useState<ToolType>(ToolType.IMAGE_COMPRESS);
    const [inputValue, setInputValue] = useState("");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [result, setResult] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [imageResult, setImageResult] = useState<string | null>(null); // 存储处理后的图片链接/Base64
    const [compressQuality, setCompressQuality] = useState(0.7); // 压缩质量（0.1-1.0）
    const [maxPixel, setMaxPixel] = useState(1920); // 最大像素限制（默认1920px，超过则等比缩放）
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 切换工具：重置所有状态
    const handleToolChange = (tool: ToolType) => {
        setActiveTool(tool);
        setInputValue("");
        setSelectedFile(null);
        setResult("");
        setImageResult(null);
        setCompressQuality(0.7); // 重置压缩质量
        setMaxPixel(1920); // 重置最大像素
    };

    // 处理文件选择
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type.startsWith("image/")) {
            setSelectedFile(file);
            setImageResult(null);
            setResult("");
        }
    };

    // 触发文件选择
    const triggerFileSelect = () => {
        fileInputRef.current?.click();
    };

    // 新增：前端Canvas压缩图片（降低像素+调整质量）
    const compressImageByCanvas = async (file: File): Promise<{ base64: string; size: number }> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous"; // 解决跨域图片问题

            // 先转Base64加载图片
            imageToBase64(file).then(base64 => {
                img.src = base64;

                img.onload = () => {
                    const canvas = document.createElement("canvas");
                    const ctx = canvas.getContext("2d");
                    if (!ctx) reject(new Error("Canvas上下文获取失败"));

                    // 计算目标尺寸：等比缩放，最大边长不超过maxPixel
                    let targetWidth = img.width;
                    let targetHeight = img.height;
                    const scaleRatio = Math.min(1, maxPixel / targetWidth, maxPixel / targetHeight);

                    if (scaleRatio < 1) {
                        targetWidth = Math.round(targetWidth * scaleRatio);
                        targetHeight = Math.round(targetHeight * scaleRatio);
                    }

                    // 设置Canvas尺寸（降低像素核心步骤）
                    canvas.width = targetWidth;
                    canvas.height = targetHeight;

                    // 绘制图片（抗锯齿优化）
                    ctx.clearRect(0, 0, targetWidth, targetHeight);
                    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

                    // 转换为Blob（调整质量）
                    canvas.toBlob(
                        (blob) => {
                            if (!blob) reject(new Error("图片压缩失败"));
                            // 转Base64返回（用于预览和展示）
                            imageToBase64(new File([blob], file.name, { type: blob.type })).then(compressedBase64 => {
                                resolve({
                                    base64: compressedBase64,
                                    size: blob.size // 压缩后文件大小
                                });
                            });
                        },
                        file.type || "image/jpeg", // 沿用原文件格式，无则默认jpeg
                        compressQuality // 压缩质量（0.1=最低质量，1.0=原质量）
                    );
                };

                img.onerror = () => reject(new Error("图片加载失败"));
            }).catch(err => reject(err));
        });
    };

    // 复制链接/Base64功能
    const copyImageUrl = (url: string) => {
        navigator.clipboard.writeText(url).then(() => {
            setResult("链接已复制到剪贴板！");
            setTimeout(() => {
                setResult(imageResult.startsWith("data:image/") ? "图片Base64已复制" : `图片链接：${url}`);
            }, 2000);
        }).catch(() => {
            setResult("链接复制失败，请手动复制");
        });
    };

    // 提交请求（图片压缩单独处理，其他功能沿用原有逻辑）
    const handleSubmit = async () => {
        try {
            setLoading(true);
            setImageResult(null);

            // 图片压缩：前端Canvas处理（不调用AI）
            if (activeTool === ToolType.IMAGE_COMPRESS) {
                if (!selectedFile) throw new Error("请选择图片");

                // 执行前端压缩
                const compressedData = await compressImageByCanvas(selectedFile);
                const originalSize = selectedFile.size / 1024 / 1024; // 原大小（MB）
                const compressedSize = compressedData.size / 1024 / 1024; // 压缩后大小（MB）
                const compressRatio = Math.round(((originalSize - compressedSize) / originalSize) * 100); // 压缩比例

                // 存储压缩后的Base64（用于预览）
                setImageResult(compressedData.base64);
                // 显示压缩信息
                setResult(
                    `压缩成功！\n` +
                    `原始尺寸：${selectedFile.width || "未知"}x${selectedFile.height || "未知"}px | 大小：${originalSize.toFixed(2)}MB\n` +
                    `压缩后尺寸：${compressedData.base64.match(/width="(\d+)"/)?.[1] || "未知"}x${compressedData.base64.match(/height="(\d+)"/)?.[1] || "未知"}px | 大小：${compressedSize.toFixed(2)}MB\n` +
                    `压缩比例：${compressRatio}% | 质量：${(compressQuality * 100).toFixed(0)}%`
                );
                return;
            }

            // 其他功能（AI生图、识别、抠图）沿用原有逻辑
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
            setResult((error as Error).message);
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
                    // 其他工具：图片上传 + 图片压缩专属配置
                    <div>
                        <button
                            onClick={triggerFileSelect}
                            className="px-6 py-3 bg-gray-300 hover:bg-gray-400 rounded-lg mb-4 shadow-md transition duration-200"
                        >
                            选择图片
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept="image/*"
                            className="hidden"
                        />
                        {selectedFile && (
                            <p className="text-sm text-gray-600 mb-4">
                                已选择：{selectedFile.name} | 大小：{(selectedFile.size / 1024 / 1024).toFixed(2)}MB
                            </p>
                        )}

                        {/* 图片压缩专属：质量+像素调节滑块 */}
                        {activeTool === ToolType.IMAGE_COMPRESS && (
                            <div className="mb-4 space-y-4">
                                {/* 压缩质量调节 */}
                                <div>
                                    <label className="block mb-1 text-sm text-gray-600">
                                        压缩质量：{Math.round(compressQuality * 100)}%
                                    </label>
                                    <input
                                        type="range"
                                        min="0.1"
                                        max="1"
                                        step="0.1"
                                        value={compressQuality}
                                        onChange={(e) => setCompressQuality(Number(e.target.value))}
                                        className="w-full"
                                    />
                                </div>

                                {/* 最大像素调节 */}
                                <div>
                                    <label className="block mb-1 text-sm text-gray-600">
                                        最大边长限制：{maxPixel}px（超过自动缩放）
                                    </label>
                                    <input
                                        type="range"
                                        min="320"
                                        max="4096"
                                        step="100"
                                        value={maxPixel}
                                        onChange={(e) => setMaxPixel(Number(e.target.value))}
                                        className="w-full"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* 提交按钮 */}
                <button
                    onClick={handleSubmit}
                    className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg transition duration-200 hover:scale-105"
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
                <pre className="whitespace-pre-wrap text-sm text-gray-700">{result}</pre>
            </div>
        </div>
    );
};

export default ImageTools;
