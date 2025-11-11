// API 请求类型
export type MessageContentText = {
    type: "text";
    text: string;
};

export type MessageContentImage = {
    type: "image_url";
    image_url: {
        url: string; // 图片 Base64 或在线 URL
    };
};

export type MessageContent = MessageContentText | MessageContentImage;

export type ChatMessage = {
    role: "user";
    content: MessageContent | MessageContent[];
};

export type ApiRequestParams = {
    model: "gpt-4o" | "deepseek-r1" | "gemini-2.5-flash-image";
    stream: boolean;
    messages: ChatMessage[];
    max_tokens: number;
    temperature?: number;
};

// 功能枚举
export enum ToolType {
    IMAGE_COMPRESS = "imageCompress",
    AI_GENERATE = "aiGenerate",
    IMAGE_RECOGNIZE = "imageRecognize",
    BACKGROUND_REMOVE = "backgroundRemove",
}