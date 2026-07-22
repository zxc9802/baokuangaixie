'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Spinner,
  Check,
  Warning,
  ArrowRight,
  ArrowLeft,
  StopCircle,
  DownloadSimple,
  PlugsConnected,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
import { ProgressBar } from '@/components/ui/progress-bar';
import {
  parseSearchPlan,
  createCaptureJob,
  getCaptureJob,
  cancelCaptureJob,
} from '@/lib/api';
import { useTopics } from '@/hooks/use-idb';
import {
  cancelBrowserCapture,
  detectBrowserExtension,
  startBrowserCapture,
} from '@/lib/browser-extension';
import type { SearchPlan, CaptureJob } from '@/lib/types';

export default function CapturePage() {
  const router = useRouter();
  const { saveTopics } = useTopics();

  const [text, setText] = useState(
    '找 20 条近半年发布的职场女性成长类视频，排除纯鸡汤，优先真实故事，按点赞最高排序。'
  );
  const [plan, setPlan] = useState<SearchPlan | null>(null);
  const [requestedCount, setRequestedCount] = useState('');
  const [job, setJob] = useState<CaptureJob | null>(null);
  const [loading, setLoading] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState('');
  const [extensionConnected, setExtensionConnected] = useState(false);
  const [checkingExtension, setCheckingExtension] = useState(true);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollVersionRef = useRef(0);

  useEffect(() => {
    void refreshExtensionStatus();
    return () => {
      pollVersionRef.current += 1;
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  async function refreshExtensionStatus() {
    setCheckingExtension(true);
    const status = await detectBrowserExtension();
    setExtensionConnected(status.connected);
    setCheckingExtension(false);
  }

  async function handleParse() {
    setLoading(true);
    setError('');
    try {
      const { plan } = await parseSearchPlan(text);
      setPlan(plan);
      setRequestedCount(String(plan.requestedCount));
    } catch (err) {
      setError(err instanceof Error ? err.message : '解析失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!plan) return;
    const count = Number(requestedCount);
    if (!Number.isInteger(count) || count < 1 || count > 100) {
      setError('目标数量请输入 1 到 100 之间的整数');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const extension = await detectBrowserExtension();
      setExtensionConnected(extension.connected);
      if (!extension.connected) {
        throw new Error('未检测到扩展，请先下载安装，并在扩展中配置当前网站地址');
      }

      const capture = await createCaptureJob({
        ...plan,
        requestedCount: count,
      });
      try {
        await startBrowserCapture({
          jobId: capture.jobId,
          browserToken: capture.browserToken,
          plan: capture.job.plan,
        });
      } catch (extensionError) {
        await cancelCaptureJob(capture.jobId).catch(() => {});
        throw extensionError;
      }
      setJob(capture.job);
      pollJob(capture.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建任务失败');
      setLoading(false);
    }
  }

  function pollJob(jobId: string) {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    const pollVersion = ++pollVersionRef.current;
    const interval = setInterval(async () => {
      try {
        const job = await getCaptureJob(jobId);
        if (pollVersion !== pollVersionRef.current) return;
        setJob(job);
        if (
          job.phase === 'complete' ||
          job.phase === 'partial' ||
          job.phase === 'failed' ||
          job.phase === 'cancelled'
        ) {
          clearInterval(interval);
          pollTimerRef.current = null;
          setLoading(false);
        }
      } catch (err) {
        if (pollVersion !== pollVersionRef.current) return;
        clearInterval(interval);
        pollTimerRef.current = null;
        setError(err instanceof Error ? err.message : '轮询任务失败');
        setLoading(false);
      }
    }, 1200);
    pollTimerRef.current = interval;
  }

  async function handleStopCapture() {
    if (!job || !isRunning || stopping) return;
    setStopping(true);
    setError('');
    pollVersionRef.current += 1;
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = null;
    try {
      await cancelBrowserCapture(job.id);
      const cancelledJob = await cancelCaptureJob(job.id);
      setJob(cancelledJob);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '停止抓取失败');
      pollJob(job.id);
    } finally {
      setStopping(false);
    }
  }

  async function handleSaveTopics() {
    if (!job?.topics.length) return;
    await saveTopics(job.topics);
    router.push('/topics');
  }

  const isRunning =
    job &&
    !['complete', 'partial', 'failed', 'cancelled'].includes(job.phase);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">抓取爆款视频</h1>
        <p className="text-muted-foreground">
          描述你想要的视频类型，AI 会先解析成计划，确认后才开始抓取。
        </p>
      </div>

      <Card className={extensionConnected ? 'border-success/40' : 'border-warning/50'}>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-medium">
              <PlugsConnected className="h-5 w-5" />
              抖音视频抓取扩展
              <Badge
                variant={extensionConnected ? 'success' : 'warning'}
                data-testid="extension-status"
              >
                {checkingExtension
                  ? '检测中'
                  : extensionConnected
                    ? '已连接'
                    : '未连接'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              扩展只在你配置的本站和抖音页面运行，使用你自己的抖音登录态采集视频。
            </p>
            {!extensionConnected && !checkingExtension && (
              <details className="text-sm text-muted-foreground">
                <summary className="cursor-pointer text-foreground">
                  首次安装说明
                </summary>
                <ol className="mt-2 list-decimal space-y-1 pl-5">
                  <li>下载并解压扩展安装包。</li>
                  <li>
                    打开 Chrome 的 chrome://extensions，开启开发者模式并加载解压目录。
                  </li>
                  <li>点击扩展图标，填写当前网站地址并保存授权。</li>
                  <li>在同一个 Chrome 登录抖音，再回到这里重新检测。</li>
                </ol>
              </details>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={refreshExtensionStatus}>
              重新检测
            </Button>
            <Button asChild variant="outline">
              <a href="/video-script-browser-extension.zip" download>
                <DownloadSimple className="h-4 w-4" />
                下载扩展
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <AnimatePresence mode="wait">
        {!plan && !job && (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-4"
          >
            <Card>
              <CardContent className="space-y-4 p-6">
                <div className="space-y-2">
                  <Label htmlFor="requirement">自然语言要求</Label>
                  <Textarea
                    id="requirement"
                    rows={5}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="例如：找 20 条近半年发布的职场女性成长类视频..."
                  />
                </div>
                <Button
                  onClick={handleParse}
                  disabled={loading || !text.trim()}
                  size="lg"
                >
                  {loading && <Spinner className="h-4 w-4 animate-spin" />}
                  解析要求
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {plan && !job && (
          <motion.div
            key="plan"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-4"
          >
            <Card className="border-l-4 border-l-accent">
              <CardHeader>
                <CardTitle>抓取计划确认</CardTitle>
                <CardDescription>请确认解析结果，确认后将创建抓取任务。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">主题概括</Label>
                    <Input value={plan.summary} readOnly />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">目标数量</Label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      step={1}
                      value={requestedCount}
                      onChange={(event) => {
                        setRequestedCount(event.target.value);
                        setError('');
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground">查询词</Label>
                  <div className="flex flex-wrap gap-2">
                    {plan.queries.map((q) => (
                      <Badge key={q} variant="secondary">{q}</Badge>
                    ))}
                  </div>
                </div>

                {(plan.includeKeywords.length > 0 || plan.excludeKeywords.length > 0) && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {plan.includeKeywords.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">必须包含</Label>
                        <div className="flex flex-wrap gap-2">
                          {plan.includeKeywords.map((k) => (
                            <Badge key={k} variant="success">{k}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {plan.excludeKeywords.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">必须排除</Label>
                        <div className="flex flex-wrap gap-2">
                          {plan.excludeKeywords.map((k) => (
                            <Badge key={k} variant="danger">{k}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setPlan(null);
                      setError('');
                    }}
                    disabled={loading}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    返回修改
                  </Button>
                  <Button onClick={handleConfirm} disabled={loading}>
                    {loading && <Spinner className="h-4 w-4 animate-spin" />}
                    确认并抓取
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {job && (
          <motion.div
            key="job"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-4"
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {isRunning && (
                    <Spinner className="h-5 w-5 animate-spin text-accent" />
                  )}
                  {job.phase === 'complete' && (
                    <Check className="h-5 w-5 text-success" />
                  )}
                  {job.phase === 'partial' && (
                    <Warning className="h-5 w-5 text-warning" />
                  )}
                  {job.phase === 'failed' && (
                    <Warning className="h-5 w-5 text-danger" />
                  )}
                  任务状态：{phaseLabel(job.phase)}
                </CardTitle>
                <CardDescription>
                  {job.shortfallReason || `已完成 ${job.topics.length} 条选题`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ProgressBar value={job.progress} />

                {isRunning && (
                  <div className="flex justify-end">
                    <Button
                      variant="danger"
                      onClick={handleStopCapture}
                      disabled={stopping}
                    >
                      {stopping ? (
                        <Spinner className="h-4 w-4 animate-spin" />
                      ) : (
                        <StopCircle className="h-4 w-4" />
                      )}
                      {stopping ? '正在停止…' : '停止抓取'}
                    </Button>
                  </div>
                )}

                {job.topics.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">已入选选题</Label>
                    <div className="space-y-2">
                      {job.topics.map((topic) => (
                        <div
                          key={topic.id}
                          className="rounded-lg border border-border bg-muted/30 p-3"
                        >
                          <div className="font-medium">{topic.summaryTitle}</div>
                          <div className="text-xs text-muted-foreground">
                            {topic.authorName} · {topic.likes.toLocaleString()} 赞
                          </div>
                          {topic.videoAnalysis && (
                            <Badge className="mt-2" variant="success">
                              原文和视频结构已解析
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {job.failures.length > 0 && !isRunning && (
                  <div className="rounded-lg border border-warning/50 bg-warning/5 p-3 text-sm">
                    <div className="font-medium">
                      {job.failures.length} 条视频未完成分析
                    </div>
                    <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                      {job.failures.map((failure, index) => (
                        <div key={`${failure.awemeId || 'unknown'}-${index}`}>
                          {failure.awemeId ? `${failure.awemeId}：` : ''}
                          {failure.reason}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!isRunning && job.topics.length > 0 && (
                  <Button onClick={handleSaveTopics}>
                    <Check className="h-4 w-4" />
                    保存到选题库
                  </Button>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <Card className="border-danger">
          <CardContent className="p-4 text-sm text-danger">{error}</CardContent>
        </Card>
      )}
    </div>
  );
}

function phaseLabel(phase: CaptureJob['phase']): string {
  const map: Record<CaptureJob['phase'], string> = {
    queued: '排队中',
    searching: '正在搜索',
    filtering: '正在筛选',
    downloading: '正在下载',
    transcribing: '正在解析原文和视频结构',
    summarizing: '正在保存分析结果',
    complete: '已完成',
    partial: '部分完成',
    failed: '失败',
    cancelled: '已取消',
  };
  return map[phase];
}
