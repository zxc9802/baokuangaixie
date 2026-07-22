'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import { motion } from 'framer-motion';
import { nanoid } from 'nanoid';
import {
  Plus,
  Package,
  PencilSimple,
  Trash,
  X,
  FileText,
  ImageSquare,
  Spinner,
} from '@phosphor-icons/react';
import { useProducts } from '@/hooks/use-idb';
import { parseProductUpload } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { Product } from '@/lib/types';

const emptyProduct: Product = {
  id: '',
  name: '',
  category: '',
  summary: '',
  targetAudience: '',
  sellingPoints: [''],
  usageScenarios: [''],
  factualClaims: [''],
  forbiddenClaims: [''],
  toneNotes: '',
  updatedAt: '',
};

export default function ProductsPage() {
  const { products, loading, saveProduct, deleteProduct } = useProducts();
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<Product>(emptyProduct);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [isParsingUpload, setIsParsingUpload] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadError, setUploadError] = useState('');

  function resetUploadFeedback() {
    setUploadStatus('');
    setUploadError('');
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyProduct);
    setIsFormOpen(true);
    resetUploadFeedback();
  }

  function openEdit(product: Product) {
    setEditing(product);
    setIsFormOpen(true);
    resetUploadFeedback();
    setForm({
      ...product,
      sellingPoints: product.sellingPoints.length ? product.sellingPoints : [''],
      usageScenarios: product.usageScenarios.length
        ? product.usageScenarios
        : [''],
      factualClaims: product.factualClaims.length ? product.factualClaims : [''],
      forbiddenClaims: product.forbiddenClaims.length
        ? product.forbiddenClaims
        : [''],
    });
  }

  function closeForm() {
    setEditing(null);
    setForm(emptyProduct);
    setIsFormOpen(false);
    resetUploadFeedback();
  }

  async function handleProductUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setIsParsingUpload(true);
    setUploadStatus('');
    setUploadError('');

    try {
      const result = await parseProductUpload(file);
      setForm((previous) => ({
        ...previous,
        ...result.product,
        id: previous.id,
        updatedAt: previous.updatedAt,
      }));

      const sourceLabel =
        result.sourceType === 'product_photo'
          ? '已识别为产品外观图'
          : result.sourceType === 'product_info_image'
            ? '已识别为产品信息图'
            : '文档解析完成';
      const truncatedLabel = result.truncated
        ? '；文档较长，已保留开头和结尾重点内容'
        : '';
      setUploadStatus(`${result.fileName} · ${sourceLabel}${truncatedLabel}`);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : '产品资料解析失败');
    } finally {
      setIsParsingUpload(false);
    }
  }

  function handleSave() {
    const now = new Date().toISOString();
    const product: Product = {
      ...form,
      id: editing?.id || nanoid(),
      updatedAt: now,
      sellingPoints: form.sellingPoints.filter(Boolean),
      usageScenarios: form.usageScenarios.filter(Boolean),
      factualClaims: form.factualClaims.filter(Boolean),
      forbiddenClaims: form.forbiddenClaims.filter(Boolean),
    };
    saveProduct(product);
    closeForm();
  }

  function updateArrayField(
    field: keyof Product,
    index: number,
    value: string
  ) {
    setForm((prev) => {
      const arr = [...(prev[field] as string[])];
      arr[index] = value;
      return { ...prev, [field]: arr };
    });
  }

  function addArrayField(field: keyof Product) {
    setForm((prev) => ({
      ...prev,
      [field]: [...(prev[field] as string[]), ''],
    }));
  }

  function removeArrayField(field: keyof Product, index: number) {
    setForm((prev) => {
      const arr = [...(prev[field] as string[])];
      arr.splice(index, 1);
      return { ...prev, [field]: arr.length ? arr : [''] };
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">产品案例库</h1>
          <p className="text-muted-foreground">
            维护公司产品资料，供脚本生成时引用事实依据。
          </p>
        </div>
        {!isFormOpen && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            新建产品
          </Button>
        )}
      </div>

      {isFormOpen && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{editing ? '编辑产品' : '新建产品'}</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={closeForm}
              disabled={isParsingUpload}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="font-medium">上传产品资料并自动解析</div>
                  <p className="text-sm text-muted-foreground">
                    支持产品文档、产品实拍图和带文字的产品信息图。
                  </p>
                  <p className="text-xs text-muted-foreground">
                    解析结果会回填下方表单，保存前仍可修改。文档最大 10MB，图片最大 8MB。
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => documentInputRef.current?.click()}
                    disabled={isParsingUpload}
                  >
                    <FileText className="h-4 w-4" />
                    上传文档
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={isParsingUpload}
                  >
                    <ImageSquare className="h-4 w-4" />
                    上传图片
                  </Button>
                  <input
                    ref={documentInputRef}
                    type="file"
                    accept=".pdf,.docx,.txt,.md"
                    className="hidden"
                    onChange={handleProductUpload}
                  />
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={handleProductUpload}
                  />
                </div>
              </div>

              {isParsingUpload && (
                <div className="mt-3 flex items-center gap-2 text-sm text-accent">
                  <Spinner className="h-4 w-4 animate-spin" />
                  正在读取并解析产品资料…
                </div>
              )}
              {uploadStatus && (
                <div className="mt-3 text-sm text-success">{uploadStatus}</div>
              )}
              {uploadError && (
                <div className="mt-3 text-sm text-danger">{uploadError}</div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">产品名称 *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="例如：氨基酸洁面乳"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">分类</Label>
                <Input
                  id="category"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="例如：护肤"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="summary">产品简介</Label>
              <Textarea
                id="summary"
                rows={3}
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
                placeholder="一句话介绍产品核心定位"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetAudience">目标受众</Label>
              <Input
                id="targetAudience"
                value={form.targetAudience}
                onChange={(e) => setForm({ ...form, targetAudience: e.target.value })}
                placeholder="例如：25-35 岁敏感肌女性"
              />
            </div>

            {(
              [
                ['sellingPoints', '卖点'],
                ['usageScenarios', '使用场景'],
                ['factualClaims', '允许使用的事实依据'],
              ] as const
            ).map(([field, label]) => (
              <ArrayFieldEditor
                key={field}
                label={label}
                values={form[field]}
                onChange={(i, v) => updateArrayField(field, i, v)}
                onAdd={() => addArrayField(field)}
                onRemove={(i) => removeArrayField(field, i)}
              />
            ))}

            <ArrayFieldEditor
              label="禁止使用的声明"
              values={form.forbiddenClaims}
              onChange={(i, v) => updateArrayField('forbiddenClaims', i, v)}
              onAdd={() => addArrayField('forbiddenClaims')}
              onRemove={(i) => removeArrayField('forbiddenClaims', i)}
              variant="danger"
            />

            <div className="space-y-2">
              <Label htmlFor="toneNotes">语气要求</Label>
              <Textarea
                id="toneNotes"
                rows={2}
                value={form.toneNotes}
                onChange={(e) => setForm({ ...form, toneNotes: e.target.value })}
                placeholder="例如：亲切、专业、不过度承诺"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={closeForm}
                disabled={isParsingUpload}
              >
                取消
              </Button>
              <Button
                onClick={handleSave}
                disabled={isParsingUpload || !form.name.trim()}
              >
                保存
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground">加载中…</div>
      ) : products.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <Package className="h-10 w-10 text-muted-foreground" />
            <div className="text-muted-foreground">暂无产品，点击上方按钮创建。</div>
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
          {products.map((product) => (
            <motion.div
              key={product.id}
              variants={{
                hidden: { opacity: 0, y: 6 },
                show: { opacity: 1, y: 0 },
              }}
            >
              <Card>
                <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="space-y-1">
                    <h3 className="font-medium">{product.name}</h3>
                    <p className="text-sm text-muted-foreground">{product.summary}</p>
                    <div className="text-xs text-muted-foreground">
                      卖点 {product.sellingPoints.length} · 事实依据{' '}
                      {product.factualClaims.length} · 禁用声明{' '}
                      {product.forbiddenClaims.length}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(product)}
                    >
                      <PencilSimple className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-danger hover:bg-danger/10"
                      onClick={() => deleteProduct(product.id)}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}

function ArrayFieldEditor({
  label,
  values,
  onChange,
  onAdd,
  onRemove,
  variant = 'default',
}: {
  label: string;
  values: string[];
  onChange: (index: number, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  variant?: 'default' | 'danger';
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="space-y-2">
        {values.map((value, i) => (
          <div key={i} className="flex gap-2">
            <Input
              value={value}
              onChange={(e) => onChange(i, e.target.value)}
              placeholder={`${label} ${i + 1}`}
              className={
                variant === 'danger'
                  ? 'border-danger/50 focus-visible:ring-danger'
                  : ''
              }
            />
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => onRemove(i)}
              disabled={values.length === 1 && !values[0]}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button variant="ghost" size="sm" onClick={onAdd}>
          <Plus className="h-4 w-4" />
          添加
        </Button>
      </div>
    </div>
  );
}
