import { useEffect, useRef } from "react";

// 登录页品牌面板里的动态机器人：眼睛跟随光标、整体随光标轻微倾斜（视差），
// 用 requestAnimationFrame + lerp 平滑跟随，性能友好；尊重 prefers-reduced-motion。
export default function RobotMascot() {
  const bodyRef = useRef<SVGGElement>(null);
  const pupilsRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    // 归一化光标位置：-1 ~ 1（以视口中心为原点）
    const target = { x: 0, y: 0 };
    const cur = { x: 0, y: 0 };
    let raf = 0;

    function onMove(e: MouseEvent) {
      target.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.y = (e.clientY / window.innerHeight) * 2 - 1;
    }

    function tick() {
      // 平滑跟随（lerp）
      cur.x += (target.x - cur.x) * 0.08;
      cur.y += (target.y - cur.y) * 0.08;

      if (bodyRef.current) {
        const rot = cur.x * 6; // 整体倾斜 ±6°
        const tx = cur.x * 6;
        const ty = cur.y * 8;
        bodyRef.current.style.transform = `translate(${tx}px, ${ty}px) rotate(${rot}deg)`;
      }
      if (pupilsRef.current) {
        const dx = cur.x * 4; // 瞳孔朝光标方向偏移
        const dy = cur.y * 4;
        pupilsRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
      }
      raf = requestAnimationFrame(tick);
    }

    window.addEventListener("mousemove", onMove);
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="robot-mascot" aria-hidden="true">
      <svg className="robot-svg" viewBox="0 0 120 150">
        <g ref={bodyRef} className="robot-body">
          {/* 天线 */}
          <line x1="60" y1="22" x2="60" y2="8" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          <circle cx="60" cy="6" r="4" fill="#ff2442" />
          {/* 头 */}
          <rect x="28" y="22" width="64" height="50" rx="14" fill="#ffffff" stroke="rgba(0,0,0,0.10)" strokeWidth="1" />
          {/* 眼窝 */}
          <circle cx="48" cy="46" r="11" fill="#eef0f3" />
          <circle cx="72" cy="46" r="11" fill="#eef0f3" />
          {/* 瞳孔（跟随光标） */}
          <g ref={pupilsRef} className="robot-pupils">
            <circle cx="48" cy="46" r="4.5" fill="#1f2329" />
            <circle cx="72" cy="46" r="4.5" fill="#1f2329" />
          </g>
          {/* 嘴 */}
          <path d="M50 62 Q60 70 70 62" stroke="#1f2329" strokeWidth="3" fill="none" strokeLinecap="round" />
          {/* 身体（白底，与红橙背景区分） */}
          <rect x="38" y="80" width="44" height="48" rx="12" fill="#ffffff" stroke="rgba(0,0,0,0.10)" strokeWidth="1" />
          {/* 胸前红点（品牌色点缀） */}
          <rect x="48" y="92" width="24" height="14" rx="4" fill="#ff2442" />
          {/* 手臂 */}
          <rect x="26" y="86" width="10" height="26" rx="5" fill="#ffffff" stroke="rgba(0,0,0,0.10)" strokeWidth="1" />
          <rect x="84" y="86" width="10" height="26" rx="5" fill="#ffffff" stroke="rgba(0,0,0,0.10)" strokeWidth="1" />
        </g>
      </svg>
    </div>
  );
}
