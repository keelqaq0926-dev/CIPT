"use client";
import ImageTools from "@/components/ImageTools";
import { ToolType } from "@/types";
import { useEffect, useState } from "react";

export default function Home() {
  const tools = [
    { id: "compress", title: "图片压缩", desc: "智能压缩与尺寸限制", tool: ToolType.IMAGE_COMPRESS },
    { id: "ai-generate", title: "AI 生图", desc: "文本到图像生成", tool: ToolType.AI_GENERATE },
    { id: "recognize", title: "图片识别", desc: "智能内容识别与分析", tool: ToolType.IMAGE_RECOGNIZE },
    { id: "remove-bg", title: "抠图去背景", desc: "一键去底快速抠图", tool: ToolType.BACKGROUND_REMOVE },
  ];
  const navSections = [{ id: "overview", title: "总览" }, ...tools.map(t => ({ id: t.id, title: t.title }))];
  const [active, setActive] = useState<string>(navSections[0].id);
  const onJump = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const featuresFor = (id: string) => {
    switch (id) {
      case "compress":
        return [
          { icon: "/file.svg", title: "高效压缩", desc: "体积最高可降 80%" },
          { icon: "/window.svg", title: "尺寸限制", desc: "按最大边长等比缩放" },
          { icon: "/globe.svg", title: "格式保留", desc: "尽量保持原格式" },
          { icon: "/next.svg", title: "快速输出", desc: "本地处理更迅速" },
        ];
      case "ai-generate":
        return [
          { icon: "/globe.svg", title: "文本到图像", desc: "一句话生成创意图" },
          { icon: "/file.svg", title: "多风格", desc: "插画/写真/赛博等" },
          { icon: "/window.svg", title: "高清输出", desc: "更细节更清晰" },
          { icon: "/next.svg", title: "流式生成", desc: "实时返回进度" },
        ];
      case "recognize":
        return [
          { icon: "/globe.svg", title: "智能识别", desc: "内容/标签自动提取" },
          { icon: "/file.svg", title: "多类型", desc: "通用、场景、物体" },
          { icon: "/window.svg", title: "结构化", desc: "可读性更强的结果" },
          { icon: "/next.svg", title: "快速响应", desc: "低延迟返回" },
        ];
      case "remove-bg":
        return [
          { icon: "/file.svg", title: "一键去底", desc: "即刻获得透明 PNG" },
          { icon: "/window.svg", title: "边缘保真", desc: "发丝等细节更清晰" },
          { icon: "/globe.svg", title: "批量可用", desc: "重复工作更高效" },
          { icon: "/next.svg", title: "下载便捷", desc: "直接复制或保存" },
        ];
      default:
        return [];
    }
  };

  useEffect(() => {
    const root = document.querySelector('.snap-container') as HTMLElement | null;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target?.id) setActive(visible.target.id);
      },
      { threshold: [0.6], root }
    );

    navSections.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);
  return (
      <main className="snap-container">
        <nav className="dot-nav" aria-label="章节导航">
          {navSections.map(s => (
            <a
              key={s.id}
              href={`#${s.id}`}
              onClick={onJump(s.id)}
              className={`dot ${active === s.id ? "active" : ""}`}
              aria-label={s.title}
              aria-current={active === s.id ? "true" : undefined}
            />
          ))}
        </nav>

        <section id="overview" className="snap-section section-bg">
          <div className="section-content max-w-6xl mx-auto px-4">
            <header className="mb-10 text-center">
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-violet-500">
                图片工具集
              </h1>
              <p className="mt-3 text-sm text-[var(--muted-foreground)]">压缩 · 生图 · 识别 · 抠图 —— 功能不变，体验升级</p>
            </header>
            <div aria-label="工具总览" className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
              {tools.map((s) => (
                <a key={s.id} href={`#${s.id}`} onClick={onJump(s.id)} className="glass-panel p-5 md:p-6 hover:shadow-xl transition-transform duration-200 hover:-translate-y-0.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{s.title}</h3>
                      <p className="mt-1 text-sm text-[var(--muted-foreground)]">{s.desc}</p>
                    </div>
                    <span className="btn-base btn-secondary h-9 w-9">→</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>

        {tools.map((s) => (
          <section key={s.id} id={s.id} aria-label={s.title} className="snap-section section-bg">
            <div className="section-content max-w-6xl mx-auto px-4 h-full flex flex-col justify-center">
              <div className="mb-4">
                <h2 className="text-2xl font-bold">{s.title}</h2>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">{s.desc}</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-center">
                <div className="hero-card">
                  <div className="hero-bg"></div>
                  <div className="hero-inner">
                    <div className="hero-window relative">
                      <img src="/window.svg" alt="" className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-overlay" />
                      <span className="chip one">{s.title}</span>
                      <span className="chip two">{s.desc}</span>
                    </div>
                  </div>
                </div>
                <ImageTools mode="single" initialTool={s.tool} className="lg:h-[520px]" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                {featuresFor(s.id).map((f) => (
                  <div key={f.title} className="feature-card">
                    <div className="flex items-center gap-2">
                      <img src={f.icon} alt="" className="h-5 w-5 opacity-80" />
                      <span className="text-sm font-semibold">{f.title}</span>
                    </div>
                    <span className="text-xs text-[var(--muted-foreground)]">{f.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ))}
      </main>
  );
}