'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Trash,
  ArrowSquareOut,
  X,
  Article,
} from '@phosphor-icons/react';
import { useTopics } from '@/hooks/use-idb';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import type { Topic } from '@/lib/types';
import { formatDate, formatNumber } from '@/lib/utils';

export default function TopicsPage() {
  const { topics, loading, deleteTopic } = useTopics();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Topic | null>(null);

  const filtered = topics.filter(
    (t) =>
      t.summaryTitle.includes(query) ||
      t.originalText.includes(query) ||
      t.videoAnalysis?.structureSummary.includes(query) ||
      t.authorName.includes(query)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">选题库</h1>
          <p className="text-muted-foreground">
            已抓取并分析的抖音视频选题。
          </p>
        </div>
        <Input
          className="sm:w-72"
          placeholder="搜索标题、原文或作者..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">加载中…</div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <Article className="h-10 w-10 text-muted-foreground" />
            <div className="text-muted-foreground">
              {query ? '没有匹配的选题' : '暂无选题，去抓取页面创建任务。'}
            </div>
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
          {filtered.map((topic) => (
            <motion.div
              key={topic.id}
              variants={{
                hidden: { opacity: 0, y: 6 },
                show: { opacity: 1, y: 0 },
              }}
            >
              <Card className="cursor-pointer transition-colors hover:border-accent/50">
                <CardContent
                  className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between"
                  onClick={() => setSelected(topic)}
                >
                  <div className="space-y-1">
                    <h3 className="font-medium leading-tight">{topic.summaryTitle}</h3>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{topic.authorName}</span>
                      <span>·</span>
                      <Badge variant="secondary">{formatNumber(topic.likes)} 赞</Badge>
                      <span>·</span>
                      <span>{formatDate(topic.publishedAt)}</span>
                      <span>·</span>
                      <span>{topic.durationSeconds}s</span>
                      {topic.videoAnalysis && (
                        <Badge variant="success">视频已解析</Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-danger hover:bg-danger/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteTopic(topic.id);
                    }}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setSelected(null)}
        >
          <Card
            className="max-h-[80vh] w-full max-w-2xl overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader className="flex flex-row items-start justify-between">
              <div className="space-y-1">
                <CardTitle>{selected.summaryTitle}</CardTitle>
                <CardDescription>
                  {selected.authorName} · {formatDate(selected.publishedAt)}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelected(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">抖音文案</span>
                <p className="text-sm">{selected.sourceCaption}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  视频原文逐字稿
                </span>
                <div className="max-h-64 overflow-auto rounded-lg bg-muted/30 p-4 text-sm leading-relaxed">
                  {selected.originalText}
                </div>
              </div>
              {selected.videoAnalysis && (
                <div className="space-y-4 rounded-lg border border-border p-4">
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      开场钩子
                    </span>
                    <p className="text-sm">{selected.videoAnalysis.hook}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      整体结构
                    </span>
                    <p className="text-sm">
                      {selected.videoAnalysis.structureSummary}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      分段分析
                    </span>
                    <div className="space-y-2">
                      {selected.videoAnalysis.segments.map((segment, index) => (
                        <div
                          key={`${segment.startSeconds}-${index}`}
                          className="rounded-md bg-muted/30 p-3 text-sm"
                        >
                          <div className="font-medium">
                            {segment.startSeconds}-{segment.endSeconds}秒 ·{' '}
                            {segment.role}
                          </div>
                          {segment.spokenContent && (
                            <p className="mt-1 text-muted-foreground">
                              口播：{segment.spokenContent}
                            </p>
                          )}
                          <p className="mt-1 text-muted-foreground">
                            画面：{segment.visualContent}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      视觉亮点与说服方式
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {selected.videoAnalysis.visualHighlights.map((item) => (
                        <Badge key={`visual-${item}`} variant="secondary">
                          {item}
                        </Badge>
                      ))}
                      {selected.videoAnalysis.persuasionTechniques.map((item) => (
                        <Badge key={`persuasion-${item}`} variant="secondary">
                          {item}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    收尾：{selected.videoAnalysis.closingStyle}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" asChild
                >
                  <a
                    href={selected.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1"
                  >
                    <ArrowSquareOut className="h-4 w-4" />
                    打开来源
                  </a>
                </Button>
                <Badge variant="secondary">{formatNumber(selected.likes)} 赞</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
