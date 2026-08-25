"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { NOTIF_BLUE } from "@/lib/agent-avatar/bloub/decor";
import { BotEngine, type BotFrame } from "@/lib/agent-avatar/bloub/engine";
import {
  EXPRESSION_BY_ID,
  type ExpressionId,
} from "@/lib/agent-avatar/bloub/expressions";
import { DEMI_VIEWBOX, RAYON } from "@/lib/agent-avatar/bloub/repere";
import { STATE_BY_ID, type StateId } from "@/lib/agent-avatar/bloub/states";
import { cn } from "@/lib/utils";

const AMBIENT_STATES: StateId[] = [
  "wink",
  "wide",
  "notify",
  "egg",
  "hexagon",
  "play",
  "swirl",
];
const PLAYFUL_EXPRESSIONS: ExpressionId[] = ["mefiant", "curieux", "confus"];

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function dotProps(dot: BotFrame["dots"][number]) {
  const common = {
    fill: dot.color || "currentColor",
    opacity: dot.opacity * (dot.depth === undefined ? 1 : 0.35 + dot.depth * 0.65),
  };
  if (dot.d) {
    return {
      ...common,
      d: dot.d,
      transform: `translate(${dot.x} ${dot.y}) rotate(${dot.rot || 0}) scale(${RAYON})`,
    };
  }
  return { ...common, cx: dot.x, cy: dot.y, r: dot.r };
}

export function AgentAvatar({
  ambient,
  animate,
  className,
  expression,
  followPointer = false,
  interactive = false,
  playful = false,
  reduceMotion,
  size = 36,
  state,
}: {
  ambient: boolean;
  animate: boolean;
  className?: string;
  expression?: ExpressionId;
  followPointer?: boolean;
  interactive?: boolean;
  playful?: boolean;
  reduceMotion: boolean;
  size?: number;
  state: StateId;
}) {
  const rawId = useId();
  const uid = useMemo(() => rawId.replace(/:/g, ""), [rawId]);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const engineRef = useRef(
    new BotEngine(RAYON, state, null, expression ? EXPRESSION_BY_ID.get(expression) || null : null),
  );
  const clockRef = useRef(0);
  const clickTimesRef = useRef<number[]>([]);
  const reactionTimerRef = useRef(0);
  const circleTimesRef = useRef<number[]>([]);
  const orbitGestureRef = useRef({ absolute: 0, lastAngle: 0, signed: 0, startedAt: 0 });
  const [displayState, setDisplayState] = useState<StateId>(state);
  const [ambientExpression, setAmbientExpression] = useState<ExpressionId | null>(null);
  const [reactionExpression, setReactionExpression] = useState<ExpressionId | null>(null);
  const [frame, setFrame] = useState(() => engineRef.current.sample(0));
  const shouldAnimate = animate && !reduceMotion;

  const playPhysicalReaction = useCallback(
    (kind: "dizzy" | "hop" | "shake") => {
      if (reduceMotion) return;
      const svg = svgRef.current;
      if (!svg) return;
      const frames =
        kind === "hop"
          ? [
              { transform: "translateY(0) scale(1)" },
              { offset: 0.42, transform: "translateY(-11px) scale(1.04, 0.96)" },
              { offset: 0.72, transform: "translateY(2px) scale(0.98, 1.02)" },
              { transform: "translateY(0) scale(1)" },
            ]
          : kind === "dizzy"
            ? [
                { transform: "rotate(0deg) translateX(0)" },
                { transform: "rotate(-8deg) translateX(-3px)" },
                { transform: "rotate(7deg) translateX(3px)" },
                { transform: "rotate(-5deg) translateX(-2px)" },
                { transform: "rotate(0deg) translateX(0)" },
              ]
            : [
                { transform: "translateX(0) rotate(0deg)" },
                { transform: "translateX(-5px) rotate(-6deg)" },
                { transform: "translateX(5px) rotate(6deg)" },
                { transform: "translateX(-4px) rotate(-4deg)" },
                { transform: "translateX(4px) rotate(4deg)" },
                { transform: "translateX(0) rotate(0deg)" },
              ];
      svg.animate(frames, {
        duration: kind === "hop" ? 460 : kind === "dizzy" ? 820 : 620,
        easing: kind === "hop" ? "cubic-bezier(0.22, 1, 0.36, 1)" : "ease-in-out",
      });
    },
    [reduceMotion],
  );

  const triggerReaction = useCallback(
    (nextExpression: ExpressionId, duration: number, motion: "dizzy" | "hop" | "shake") => {
      window.clearTimeout(reactionTimerRef.current);
      setDisplayState("idle");
      setReactionExpression(nextExpression);
      playPhysicalReaction(motion);
      reactionTimerRef.current = window.setTimeout(
        () => setReactionExpression(null),
        duration,
      );
    },
    [playPhysicalReaction],
  );

  useEffect(() => {
    if (ambient && shouldAnimate) return;
    setAmbientExpression(null);
    setDisplayState(reduceMotion ? "idle" : state);
  }, [ambient, reduceMotion, shouldAnimate, state]);

  useEffect(() => {
    if (!ambient || !shouldAnimate || reactionExpression) return;
    let disposed = false;
    let timer = 0;

    const scheduleRest = () => {
      timer = window.setTimeout(() => {
        if (disposed) return;
        const expressionMoment = playful && Math.random() < 0.65;
        const nextState =
          AMBIENT_STATES[Math.floor(Math.random() * AMBIENT_STATES.length)] || "wink";
        const nextExpression =
          PLAYFUL_EXPRESSIONS[Math.floor(Math.random() * PLAYFUL_EXPRESSIONS.length)] || "mefiant";
        setDisplayState(expressionMoment ? "idle" : nextState);
        setAmbientExpression(expressionMoment ? nextExpression : null);
        const duration = expressionMoment ? randomBetween(1800, 3200) : (STATE_BY_ID.get(nextState)?.duration || 1.8) * 1000;
        timer = window.setTimeout(() => {
          if (disposed) return;
          setDisplayState("idle");
          setAmbientExpression(null);
          scheduleRest();
        }, duration);
      }, randomBetween(1800, 5200));
    };

    setDisplayState("idle");
    setAmbientExpression(null);
    scheduleRest();
    return () => {
      disposed = true;
      window.clearTimeout(timer);
    };
  }, [ambient, playful, reactionExpression, shouldAnimate]);

  useEffect(() => {
    engineRef.current.setState(displayState, clockRef.current);
    setFrame(engineRef.current.sample(clockRef.current));
  }, [displayState]);

  useEffect(() => {
    engineRef.current.setExpression(
      reactionExpression
        ? EXPRESSION_BY_ID.get(reactionExpression) || null
        : ambientExpression
        ? EXPRESSION_BY_ID.get(ambientExpression) || null
        : expression
          ? EXPRESSION_BY_ID.get(expression) || null
          : null,
      clockRef.current,
    );
    setFrame(engineRef.current.sample(clockRef.current));
  }, [ambientExpression, expression, reactionExpression]);

  useEffect(() => {
    if (!followPointer || !shouldAnimate) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const box = svgRef.current?.getBoundingClientRect();
      if (!box || box.width === 0 || box.height === 0) return;
      const nx = clamp(
        (event.clientX - (box.left + box.width / 2)) / Math.max(1, window.innerWidth * 0.35),
        -1,
        1,
      );
      const ny = clamp(
        (event.clientY - (box.top + box.height / 2)) / Math.max(1, window.innerHeight * 0.35),
        -1,
        1,
      );
      engineRef.current.setLook(
        {
          mix: 1,
          pitch: 8 - ny * 14,
          spin: 0,
          wander: 0,
          yaw: nx * 18,
        },
        clockRef.current,
        0.2,
      );

      if (!interactive) return;
      const dx = event.clientX - (box.left + box.width / 2);
      const dy = event.clientY - (box.top + box.height / 2);
      const radius = Math.hypot(dx, dy);
      const now = performance.now();
      const gesture = orbitGestureRef.current;
      const withinOrbit = radius >= box.width * 0.7 && radius <= Math.max(220, box.width * 4.5);
      if (!withinOrbit || now - gesture.startedAt > 1800) {
        orbitGestureRef.current = {
          absolute: 0,
          lastAngle: Math.atan2(dy, dx),
          signed: 0,
          startedAt: now,
        };
        return;
      }

      const angle = Math.atan2(dy, dx);
      let delta = angle - gesture.lastAngle;
      if (delta > Math.PI) delta -= Math.PI * 2;
      if (delta < -Math.PI) delta += Math.PI * 2;
      gesture.lastAngle = angle;
      gesture.signed += delta;
      gesture.absolute += Math.abs(delta);
      const directional = Math.abs(gesture.signed) / Math.max(0.001, gesture.absolute) > 0.72;
      if (Math.abs(gesture.signed) < Math.PI * 1.7 || !directional) return;

      circleTimesRef.current = [...circleTimesRef.current.filter((time) => now - time < 3600), now];
      const repeated = circleTimesRef.current.length >= 2;
      triggerReaction(repeated ? "colere" : "confus", repeated ? 2200 : 1700, repeated ? "shake" : "dizzy");
      orbitGestureRef.current = { absolute: 0, lastAngle: angle, signed: 0, startedAt: now };
    };
    const releasePointer = () => engineRef.current.setLook(null, clockRef.current, 0.32);

    window.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerleave", releasePointer);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerleave", releasePointer);
      releasePointer();
    };
  }, [followPointer, interactive, shouldAnimate, triggerReaction]);

  useEffect(
    () => () => {
      window.clearTimeout(reactionTimerRef.current);
    },
    [],
  );

  const handleInteraction = () => {
    if (!interactive) return;
    const now = performance.now();
    clickTimesRef.current = [...clickTimesRef.current.filter((time) => now - time < 1500), now];
    const count = clickTimesRef.current.length;
    if (count >= 4) {
      clickTimesRef.current = [];
      triggerReaction("colere", 2200, "shake");
      return;
    }
    triggerReaction(count >= 2 ? "surpris" : "curieux", 850, "hop");
  };

  useEffect(() => {
    if (!shouldAnimate) {
      setFrame(engineRef.current.sample(clockRef.current));
      return;
    }

    let raf = 0;
    let previous = 0;
    const tick = (timestamp: number) => {
      const delta = previous ? Math.min((timestamp - previous) / 1000, 0.064) : 0;
      previous = timestamp;
      clockRef.current += delta;
      setFrame(engineRef.current.sample(clockRef.current));
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [shouldAnimate]);

  const maskId = `agent-avatar-mask-${uid}`;

  return (
    <svg
      ref={svgRef}
      aria-label={interactive ? "可互动的 MarkAI 助手" : "MarkAI 助手状态"}
      className={cn(
        "shrink-0 overflow-visible text-gray-950 dark:text-[#2496e8]",
        interactive && "cursor-pointer select-none outline-none focus:outline-none",
        className,
      )}
      height={size}
      onClick={handleInteraction}
      onKeyDown={(event) => {
        if (!interactive || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        handleInteraction();
      }}
      role={interactive ? "button" : "img"}
      tabIndex={interactive ? 0 : undefined}
      viewBox={`${-DEMI_VIEWBOX} ${-DEMI_VIEWBOX} ${DEMI_VIEWBOX * 2} ${DEMI_VIEWBOX * 2}`}
      width={size}
    >
      <defs>
        <mask
          height={DEMI_VIEWBOX * 2}
          id={maskId}
          maskUnits="userSpaceOnUse"
          width={DEMI_VIEWBOX * 2}
          x={-DEMI_VIEWBOX}
          y={-DEMI_VIEWBOX}
        >
          <path d={frame.bodyPath} fill="#fff" />
          {frame.eyes.map((eye, index) => (
            <path
              d={eye.d}
              fill="#000"
              key={index}
              opacity={eye.alpha}
              transform={eye.matrix}
            />
          ))}
          {frame.notch && (
            <circle cx={frame.notch.x} cy={frame.notch.y} fill="#000" r={frame.notch.r} />
          )}
        </mask>
        {frame.arcs.map((arc) => (
          <linearGradient
            gradientUnits="userSpaceOnUse"
            id={`${uid}-${arc.id}`}
            key={arc.id}
            x1={arc.grad.x1}
            x2={arc.grad.x2}
            y1={arc.grad.y1}
            y2={arc.grad.y2}
          >
            {arc.grad.stops.map((color, index) => (
              <stop
                key={`${color}-${index}`}
                offset={index / Math.max(1, arc.grad.stops.length - 1)}
                stopColor={color}
              />
            ))}
          </linearGradient>
        ))}
      </defs>

      <g fill="none" strokeLinecap="round">
        {frame.arcs.map((arc) => (
          <path
            d={arc.back}
            key={`back-${arc.id}`}
            opacity={arc.opacity}
            stroke={`url(#${uid}-${arc.id})`}
            strokeWidth={arc.width}
          />
        ))}
      </g>

      {frame.dotsBehind && (
        <g>
          {frame.dots.map((dot, index) =>
            dot.d ? (
              <path key={`dot-back-${index}`} {...dotProps(dot)} />
            ) : (
              <circle key={`dot-back-${index}`} {...dotProps(dot)} />
            ),
          )}
        </g>
      )}

      <g opacity={frame.bodyAlpha}>
        <path d={frame.bodyPath} fill="var(--chat-panel-bg)" />
        <g mask={`url(#${maskId})`}>
          <rect
            fill="currentColor"
            height={DEMI_VIEWBOX * 2}
            width={DEMI_VIEWBOX * 2}
            x={-DEMI_VIEWBOX}
            y={-DEMI_VIEWBOX}
          />
        </g>
      </g>

      {!frame.dotsBehind && (
        <g>
          {frame.dots.map((dot, index) =>
            dot.d ? (
              <path key={`dot-front-${index}`} {...dotProps(dot)} />
            ) : (
              <circle key={`dot-front-${index}`} {...dotProps(dot)} />
            ),
          )}
        </g>
      )}

      {frame.notif && (
        <circle cx={frame.notif.x} cy={frame.notif.y} fill={NOTIF_BLUE} r={frame.notif.r} />
      )}

      <g fill="none" strokeLinecap="round">
        {frame.arcs.map((arc) => (
          <path
            d={arc.front}
            key={`front-${arc.id}`}
            opacity={arc.opacity}
            stroke={`url(#${uid}-${arc.id})`}
            strokeWidth={arc.width}
          />
        ))}
      </g>
    </svg>
  );
}
