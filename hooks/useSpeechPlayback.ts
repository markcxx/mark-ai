"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { splitSpeechText } from "@/lib/chat/speech-text";

export type SpeechPlaybackState = "ended" | "idle" | "loading" | "paused" | "playing";

type ActivePlayback = {
  id: symbol;
  pause: () => void;
};

let activePlayback: ActivePlayback | null = null;

const getAudioContext = () => {
  const AudioContextClass = window.AudioContext;
  if (!AudioContextClass) throw new Error("当前浏览器不支持音频播放");
  return new AudioContextClass();
};

const readError = async (response: Response) => {
  const data = await response.json().catch(() => null);
  return typeof data?.error === "string" ? data.error : `语音合成失败 (${response.status})`;
};

export const useSpeechPlayback = ({
  onError,
  onPlaybackStart,
}: {
  onError: (message: string) => void;
  onPlaybackStart?: () => void;
}) => {
  const [state, setState] = useState<SpeechPlaybackState>("idle");
  const [chunkCount, setChunkCount] = useState(0);
  const [chunkIndex, setChunkIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [voice, setVoice] = useState("");
  const idRef = useRef(Symbol("markai-speech"));
  const contextRef = useRef<AudioContext | null>(null);
  const buffersRef = useRef<AudioBuffer[]>([]);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);
  const pausedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastRequestRef = useRef<{ content: string; voice: string } | null>(null);
  const mountedRef = useRef(true);
  const onErrorRef = useRef(onError);
  const onPlaybackStartRef = useRef(onPlaybackStart);
  onErrorRef.current = onError;
  onPlaybackStartRef.current = onPlaybackStart;

  const release = useCallback((updateState: boolean, clearBuffers = true) => {
    generationRef.current += 1;
    requestRef.current?.abort();
    requestRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (sourceRef.current) {
      sourceRef.current.onended = null;
      try {
        sourceRef.current.stop();
      } catch {
        // The source may already have ended.
      }
      sourceRef.current = null;
    }
    const context = contextRef.current;
    contextRef.current = null;
    if (context) void context.close();
    pausedRef.current = false;
    if (clearBuffers) buffersRef.current = [];
    if (activePlayback?.id === idRef.current) activePlayback = null;
    if (updateState && mountedRef.current) {
      setChunkCount(0);
      setChunkIndex(0);
      setCurrentTime(0);
      setDuration(0);
      setVoice("");
      setState("idle");
    }
  }, []);

  const pause = useCallback(() => {
    const context = contextRef.current;
    if (!context || pausedRef.current) return;
    pausedRef.current = true;
    void context.suspend();
    if (activePlayback?.id === idRef.current) activePlayback = null;
    if (mountedRef.current) setState("paused");
  }, []);

  const activate = useCallback(() => {
    if (activePlayback?.id !== idRef.current) activePlayback?.pause();
    activePlayback = { id: idRef.current, pause };
  }, [pause]);

  const resume = useCallback(() => {
    const context = contextRef.current;
    if (!context) return;
    pausedRef.current = false;
    activate();
    void context.resume();
    if (mountedRef.current) setState("playing");
  }, [activate]);

  const start = useCallback(
    (content: string, voice: string, reuseBuffers = false) => {
      const chunks = splitSpeechText(content);
      if (!chunks.length) {
        onErrorRef.current("没有可朗读的内容");
        return;
      }

      release(false, !reuseBuffers);
      lastRequestRef.current = { content, voice };
      setChunkCount(chunks.length);
      setChunkIndex(1);
      setCurrentTime(0);
      setDuration(0);
      setVoice(voice);
      const runId = generationRef.current;
      let context: AudioContext;
      try {
        context = getAudioContext();
      } catch (error) {
        onErrorRef.current(error instanceof Error ? error.message : "当前浏览器不支持音频播放");
        if (mountedRef.current) setState("idle");
        return;
      }
      contextRef.current = context;
      pausedRef.current = false;
      activate();
      void context.resume();
      if (mountedRef.current) setState("loading");

      const fail = (error: unknown) => {
        if (generationRef.current !== runId) return;
        release(true);
        if (error instanceof DOMException && error.name === "AbortError") return;
        onErrorRef.current(error instanceof Error ? error.message : "语音合成失败，请稍后重试");
      };

      const playChunk = async (index: number): Promise<void> => {
        if (generationRef.current !== runId) return;
        if (index >= chunks.length) {
          requestRef.current = null;
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          const activeContext = contextRef.current;
          contextRef.current = null;
          if (activeContext) void activeContext.close();
          pausedRef.current = false;
          if (activePlayback?.id === idRef.current) activePlayback = null;
          if (mountedRef.current) setState("ended");
          return;
        }

        if (mountedRef.current) setChunkIndex(index + 1);
        if (!pausedRef.current && mountedRef.current) setState("loading");
        const controller = new AbortController();
        requestRef.current = controller;
        try {
          let buffer = buffersRef.current[index];
          if (!buffer) {
            const response = await fetch("/api/speech", {
              body: JSON.stringify({ content: chunks[index], voice }),
              headers: { "Content-Type": "application/json" },
              method: "POST",
              signal: controller.signal,
            });
            if (!response.ok) throw new Error(await readError(response));
            buffer = await context.decodeAudioData(await response.arrayBuffer());
            buffersRef.current[index] = buffer;
          }
          if (generationRef.current !== runId) return;

          const source = context.createBufferSource();
          source.buffer = buffer;
          source.connect(context.destination);
          sourceRef.current = source;
          requestRef.current = null;
          if (mountedRef.current) {
            setCurrentTime(0);
            setDuration(buffer.duration);
          }
          const startedAt = context.currentTime;
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = setInterval(() => {
            if (!mountedRef.current || sourceRef.current !== source) return;
            setCurrentTime(Math.min(buffer.duration, context.currentTime - startedAt));
          }, 200);
          source.onended = () => {
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = null;
            if (mountedRef.current) setCurrentTime(buffer.duration);
            if (sourceRef.current === source) sourceRef.current = null;
            void playChunk(index + 1);
          };
          source.start();
          onPlaybackStartRef.current?.();
          if (!pausedRef.current && mountedRef.current) setState("playing");
        } catch (error) {
          fail(error);
        }
      };

      void playChunk(0);
    },
    [activate, release],
  );

  const stop = useCallback(() => release(true), [release]);
  const replay = useCallback(() => {
    const request = lastRequestRef.current;
    if (request) start(request.content, request.voice, true);
  }, [start]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      release(false);
    };
  }, [release]);

  return {
    chunkCount,
    chunkIndex,
    currentTime,
    duration,
    pause,
    replay,
    resume,
    start,
    state,
    stop,
    voice,
  };
};
