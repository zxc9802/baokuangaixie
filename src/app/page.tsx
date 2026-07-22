'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Article,
  Package,
  FileText,
  ArrowRight,
  MagnifyingGlass,
} from '@phosphor-icons/react';
import { useTopics } from '@/hooks/use-idb';
import { useProducts } from '@/hooks/use-idb';
import { useScripts } from '@/hooks/use-idb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getPreflight } from '@/lib/api';
import { detectBrowserExtension } from '@/lib/browser-extension';
import { useEffect, useState } from 'react';
import type { PreflightResult } from '@/lib/types';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
};

export default function DashboardPage() {
  const { topics, loading: topicsLoading } = useTopics();
  const { products, loading: productsLoading } = useProducts();
  const { scripts, loading: scriptsLoading } = useScripts();
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [extensionConnected, setExtensionConnected] = useState(false);

  useEffect(() => {
    getPreflight().then(setPreflight).catch(console.error);
    detectBrowserExtension()
      .then((status) => setExtensionConnected(status.connected))
      .catch(console.error);
  }, []);

  const stats = [
    {
      label: '选题库',
      value: topicsLoading ? '—' : topics.length,
      icon: Article,
      href: '/topics',
    },
    {
      label: '产品库',
      value: productsLoading ? '—' : products.length,
      icon: Package,
      href: '/products',
    },
    {
      label: '脚本库',
      value: scriptsLoading ? '—' : scripts.length,
      icon: FileText,
      href: '/scripts',
    },
  ];

  return (
    <motion.div
      className="space-y-8"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={item} className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">概览</h1>
        <p className="text-muted-foreground">
          从抖音爆款视频中提取灵感，为产品生成原创脚本。
        </p>
      </motion.div>

      <motion.div variants={item}>
        <Card className="border-l-4 border-l-accent">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-medium">开始一次新抓取</h2>
              <p className="text-sm text-muted-foreground">
                用自然语言描述你想要的爆款视频，AI 会帮你解析成可执行的抓取计划。
              </p>
            </div>
            <Button asChild className="shrink-0">
              <Link href="/capture">
                <MagnifyingGlass className="h-4 w-4" />
                去抓取
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        variants={container}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {stats.map((stat) => (
          <motion.div key={stat.label} variants={item}>
            <Link href={stat.href}>
              <Card className="group transition-colors hover:border-accent/50">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.label}
                  </CardTitle>
                  <stat.icon className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-accent" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold tracking-tight">
                    {stat.value}
                  </div>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
      </motion.div>

      {preflight && (
        <motion.div variants={item}>
          <Card>
            <CardHeader>
              <CardTitle>系统状态</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant={preflight.aiConfigured ? 'success' : 'danger'}>
                  {preflight.aiConfigured ? '已配置' : '未配置'}
                </Badge>
                <span className="text-sm">AI Gateway</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={extensionConnected ? 'success' : 'warning'}>
                  {extensionConnected ? '已连接' : '未连接'}
                </Badge>
                <span className="text-sm">抖音视频抓取扩展</span>
              </div>
              {preflight.messages.map((msg, i) => (
                <p key={i} className="text-sm text-muted-foreground">
                  {msg}
                </p>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
