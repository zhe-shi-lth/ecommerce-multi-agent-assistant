import { agentApi } from "./client";

export interface VideoGenerateBody {
  prompt: string;
  image_url?: string;
  video_url?: string;
  resolution?: string;
  duration?: number;
  ratio?: string;
  negative_prompt?: string;
  audio_url?: string;
  watermark?: boolean;
  audio_setting?: string;
}

export interface VideoTaskResult {
  task_id: string;
  status: string;
  video_url?: string;
}

export const generateVideo = (body: VideoGenerateBody) =>
  agentApi.post<VideoTaskResult>("/ecommerce/video/generate", body);

export const getVideoTask = (taskId: string) =>
  agentApi.get<{ status: string; video_url?: string }>(`/ecommerce/video/tasks/${taskId}`);
