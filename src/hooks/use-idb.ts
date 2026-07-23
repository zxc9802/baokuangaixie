'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { Topic, Product, GeneratedScript } from '@/lib/types';
import {
  deleteProduct as deleteProductApi,
  deleteScript as deleteScriptApi,
  deleteTopic as deleteTopicApi,
  getProducts as getProductsApi,
  getScripts as getScriptsApi,
  getTopics as getTopicsApi,
  saveProduct as saveProductApi,
  saveScripts as saveScriptsApi,
  saveTopics as saveTopicsApi,
} from '@/lib/api';

export function useTopics() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { topics: data } = await getTopicsApi();
    setTopics(
      data.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    getTopicsApi()
      .then(({ topics: data }) => {
        if (cancelled) return;
        setTopics(
          data.sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
        );
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error('读取选题库失败');
        console.error(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const saveTopics = useCallback(
    async (items: Topic[]) => {
      await saveTopicsApi(items);
      await refresh();
      toast.success(`已保存 ${items.length} 条选题`);
    },
    [refresh]
  );

  const deleteTopic = useCallback(
    async (id: string) => {
      await deleteTopicApi(id);
      await refresh();
      toast.success('已删除选题');
    },
    [refresh]
  );

  return { topics, loading, refresh, saveTopics, deleteTopic };
}

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { products: data } = await getProductsApi();
    setProducts(
      data.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    getProductsApi()
      .then(({ products: data }) => {
        if (cancelled) return;
        setProducts(
          data.sort(
            (a, b) =>
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          )
        );
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error('读取产品库失败');
        console.error(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const saveProduct = useCallback(
    async (product: Product) => {
      await saveProductApi(product);
      await refresh();
      toast.success('已保存产品');
    },
    [refresh]
  );

  const deleteProduct = useCallback(
    async (id: string) => {
      await deleteProductApi(id);
      await refresh();
      toast.success('已删除产品');
    },
    [refresh]
  );

  return { products, loading, refresh, saveProduct, deleteProduct };
}

export function useScripts() {
  const [scripts, setScripts] = useState<GeneratedScript[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { scripts: data } = await getScriptsApi();
    setScripts(
      data.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    getScriptsApi()
      .then(({ scripts: data }) => {
        if (cancelled) return;
        setScripts(
          data.sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
        );
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error('读取脚本库失败');
        console.error(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const saveScripts = useCallback(
    async (items: GeneratedScript[]) => {
      await saveScriptsApi(items);
      await refresh();
      toast.success(`已保存 ${items.length} 条脚本`);
    },
    [refresh]
  );

  const deleteScript = useCallback(
    async (id: string) => {
      await deleteScriptApi(id);
      await refresh();
      toast.success('已删除脚本');
    },
    [refresh]
  );

  return { scripts, loading, refresh, saveScripts, deleteScript };
}
