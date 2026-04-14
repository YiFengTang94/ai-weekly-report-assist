// lib/collectors/lark-wiki.ts
import { config } from '@/lib/config';
import { larkFetch, larkFetchAll } from '@/lib/lark/client';
import type { LarkWikiDoc } from '@/lib/types';

const MAX_CONTENT_LENGTH = 2000;

interface WikiNode {
  space_id: string;
  node_token: string;
  obj_token: string;
  obj_type: string;
  title: string;
  has_child?: boolean;
  node_create_time?: string;
  node_type?: string;
  obj_edit_time?: string;
  obj_create_time?: string;
}

export async function collectLarkWikiDocs(
  weekStart: string,
  weekEnd: string,
  accessToken: string
): Promise<LarkWikiDoc[]> {
  const spaceId = config.lark.wikiSpaceId;
  if (!spaceId) {
    console.warn('未配置 LARK_WIKI_SPACE_ID，跳过 Wiki 采集');
    return [];
  }

  const weekStartMs = new Date(`${weekStart}T00:00:00+08:00`).getTime();
  const weekEndMs = new Date(`${weekEnd}T23:59:59+08:00`).getTime();

  // TODO: 目前仅获取顶层节点，后续可递归遍历子节点
  const nodes = await larkFetchAll<WikiNode>(
    `/wiki/v2/spaces/${spaceId}/nodes`,
    accessToken,
    {
      params: { page_size: '50' },
      itemsKey: 'items',
      maxPages: 20,
    }
  );

  const recentDocs = nodes.filter((node) => {
    if (node.obj_type !== 'docx' && node.obj_type !== 'doc') return false;
    const editTime = Number(node.obj_edit_time ?? '0') * 1000;
    return editTime >= weekStartMs && editTime <= weekEndMs;
  });

  const results: LarkWikiDoc[] = [];
  const batchSize = 5;

  for (let i = 0; i < recentDocs.length; i += batchSize) {
    const batch = recentDocs.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map((node) => fetchWikiDocContent(node, accessToken))
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value);
      }
    }
  }

  return results;
}

async function fetchWikiDocContent(
  node: WikiNode,
  accessToken: string
): Promise<LarkWikiDoc | null> {
  try {
    const data = await larkFetch<{ content?: string }>(
      `/docx/v1/documents/${node.obj_token}/raw_content`,
      accessToken
    );

    const fullContent = data.content ?? '';
    const content = fullContent.length > MAX_CONTENT_LENGTH
      ? fullContent.slice(0, MAX_CONTENT_LENGTH) + '...（已截断）'
      : fullContent;

    return {
      title: node.title,
      content,
      updatedAt: node.obj_edit_time
        ? new Date(Number(node.obj_edit_time) * 1000).toISOString()
        : '',
      url: `https://feishu.cn/wiki/${node.node_token}`,
    };
  } catch {
    return null;
  }
}
