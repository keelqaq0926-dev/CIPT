import { ApiRequestParams } from "../types";

const API_BASE_URL = "https://ai.kaiho.cc/v1/chat/completions";
const API_KEY =process.env.NEXT_PUBLIC_AI_API_KEY || "";

// 图片转 Base64（用于本地图片上传）
export const imageToBase64 = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
    });
};

// 压缩图片（使用 canvas 简单压缩，可根据需求替换为专业库）
export const compressImage = async (
    file: File,
    quality = 0.6
): Promise<Blob> => {
    // 第一步：先把图片转成 Base64（await 只能在 async 函数顶层使用）
    const base64Url = await imageToBase64(file);

    // 第二步：用 Promise 包裹图片加载和 Canvas 压缩逻辑
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Url; // 直接使用已获取的 Base64，无需再 await

        // 跨域图片需添加（若你的图片来自跨域地址，可选添加）
        img.crossOrigin = "anonymous";

        img.onload = () => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            if (!ctx) resolve(file); // 若获取不到 Canvas 上下文，返回原文件

            // 保持宽高比，限制最大宽度 1920（避免图片过大）
            const ratio = Math.min(1, 1920 / img.width);
            canvas.width = Math.round(img.width * ratio);
            canvas.height = Math.round(img.height * ratio);

            // 绘制图片到 Canvas（抗锯齿优化）
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            // 转换 Canvas 为 Blob（按指定质量压缩）
            canvas.toBlob(
                (blob) => resolve(blob || file), // 压缩成功返回 Blob，失败返回原文件
                file.type || "image/jpeg", // 沿用原文件格式，无则默认 jpeg
                quality
            );
        };

        // 图片加载失败时，返回原文件（容错处理）
        img.onerror = () => resolve(file);
    });
};

// API 请求核心方法
export const fetchApi = async (params: ApiRequestParams) => {
    const response = await fetch(API_BASE_URL, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
    });

    if (!response.ok) {
        throw new Error(`API 请求失败: ${response.statusText}`);
    }

    return params.stream ? response.body : response.json();
};