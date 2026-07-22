'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Spinner,
  Copy,
  Check,
  Trash,
  FileText,
  Sparkle,
} from '@phosphor-icons/react';
import { useTopics } from '@/hooks/use-idb';
import { useProducts } from '@/hooks/use-idb';
import { useScripts } from '@/hooks/use-idb';
import { generateScripts } from '@/lib/api';
import {
  SCRIPT_LENGTH_OPTIONS,
  type ScriptDurationSeconds,
} from '@/lib/script-length';
import { formatScriptParagraphs, formatScriptText } from '@/lib/script-format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import type { Product } from '@/lib/types';

export default function ScriptsPage() {
  const { topics, loading: topicsLoading } = useTopics();
  const { products, loading: productsLoading } = useProducts();
  const { scripts, loading: scriptsLoading, saveScripts, deleteScript } =
    useScripts();

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [count, setCount] = useState(3);
  const [targetDurationSeconds, setTargetDurationSeconds] =
    useState<ScriptDurationSeconds>(60);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function toggleTopic(id: string) {
    setSelectedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleGenerate() {
    if (!selectedProduct || selectedTopics.size === 0) return;
    setGenerating(true);
    setError('');
    try {
      const selectedTopicList = topics.filter((t) =>
        selectedTopics.has(t.id)
      );
      const { scripts } = await generateScripts({
        topicIds: Array.from(selectedTopics),
        productId: selectedProduct.id,
        count,
        targetDurationSeconds,
        topics: selectedTopicList,
        product: selectedProduct,
      });
      await saveScripts(scripts);
      setSelectedTopics(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败');
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy(text: string, id: string) {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">脚本库</h1>
        <p className="text-muted-foreground">
          选择一个产品和若干选题，AI 会生成原创脚本。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkle className="h-5 w-5 text-accent" />
            生成新脚本
          </CardTitle>
          <CardDescription>一次最多生成 10 条。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>选择产品</Label>
            <div className="flex flex-wrap gap-2">
              {productsLoading ? (
                <span className="text-sm text-muted-foreground">加载中…</span>
              ) : products.length === 0 ? (
                <span className="text-sm text-muted-foreground">请先去产品库创建产品。</span>
              ) : (
                products.map((p) => (
                  <Button
                    key={p.id}
                    variant={
                      selectedProduct?.id === p.id ? 'default' : 'outline'
                    }
                    size="sm"
                    onClick={() => setSelectedProduct(p)}
                  >
                    {p.name}
                  </Button>
                ))
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>选择选题</Label>
            <div className="grid gap-2">
              {topicsLoading ? (
                <span className="text-sm text-muted-foreground">加载中…</span>
              ) : topics.length === 0 ? (
                <span className="text-sm text-muted-foreground">请先去抓取页面创建选题。</span>
              ) : (
                topics.map((t) => (
                  <label
                    key={t.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                      selectedTopics.has(t.id)
                        ? 'border-accent bg-accent/5'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 accent-accent"
                      checked={selectedTopics.has(t.id)}
                      onChange={() => toggleTopic(t.id)}
                    />
                    <div className="space-y-0.5">
                      <div className="text-sm font-medium">{t.summaryTitle}</div>
                      <div className="text-xs text-muted-foreground line-clamp-2">
                        {t.originalText}
                      </div>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>脚本时长与字数要求</Label>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {SCRIPT_LENGTH_OPTIONS.map((option) => {
                const selected = targetDurationSeconds === option.seconds;
                return (
                  <button
                    key={option.seconds}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setTargetDurationSeconds(option.seconds)}
                    className={`rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
                      selected
                        ? 'border-accent bg-accent/5 shadow-sm'
                        : 'border-border hover:border-accent/40 hover:bg-muted/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs tracking-widest text-muted-foreground">
                        {option.timecode}
                      </span>
                      {selected && (
                        <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
                          已选择
                        </span>
                      )}
                    </div>
                    <div className="mt-2 text-sm font-semibold">
                      {option.minCharacters}-{option.maxCharacters} 字
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {option.description}
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              字数按口播正文计算，不包含标题、创作角度和分镜标注。
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="count">生成数量（1-10）</Label>
            <Input
              id="count"
              type="number"
              min={1}
              max={10}
              value={count}
              onChange={(e) => setCount(Math.min(10, Math.max(1, Number(e.target.value))))}
              className="w-32"
            />
          </div>

          <Button
            onClick={handleGenerate}
            disabled={
              generating ||
              !selectedProduct ||
              selectedTopics.size === 0 ||
              topicsLoading ||
              productsLoading
            }
          >
            {generating && <Spinner className="h-4 w-4 animate-spin" />}
            生成脚本
          </Button>

          {error && (
            <div className="text-sm text-danger">{error}</div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-xl font-medium tracking-tight">已生成脚本</h2>

        {scriptsLoading ? (
          <div className="text-sm text-muted-foreground">加载中…</div>
        ) : scripts.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
              <FileText className="h-10 w-10 text-muted-foreground" />
              <div className="text-muted-foreground">暂无脚本，使用上方工具生成。</div>
            </CardContent>
          </Card>
        ) : (
          <motion.div
            className="grid gap-4"
            initial="hidden"
            animate="show"
            variants={{
              hidden: { opacity: 0 },
              show: {
                opacity: 1,
                transition: { staggerChildren: 0.04 },
              },
            }}
          >
            {scripts.map((script) => (
              <motion.div
                key={script.id}
                variants={{
                  hidden: { opacity: 0, y: 6 },
                  show: { opacity: 1, y: 0 },
                }}
              >
                <Card>
                  <CardHeader className="flex flex-row items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle>{script.title}</CardTitle>
                      <CardDescription>{script.angle}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleCopy(formatScriptText(script.script), script.id)
                        }
                      >
                        {copiedId === script.id ? (
                          <Check className="h-4 w-4 text-success" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-danger hover:bg-danger/10"
                        onClick={() => deleteScript(script.id)}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-3 rounded-lg bg-muted/30 p-4 text-sm leading-relaxed">
                      {formatScriptParagraphs(script.script).map(
                        (paragraph, index) => (
                          <p key={`${script.id}-paragraph-${index}`}>
                            {paragraph}
                          </p>
                        )
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {script.productClaimsUsed.map((claim) => (
                        <Badge key={claim} variant="secondary">{claim}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
