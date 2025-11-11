import ImageTools from "@/components/ImageTools";

export default function Home() {
  return (
      <main className="min-h-screen bg-gray-50 py-8">
        <h1 className="text-3xl font-bold text-center mb-8">图片工具集</h1>
        <ImageTools />
      </main>
  );
}