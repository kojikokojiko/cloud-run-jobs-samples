// src/fetchRSSFeed.ts
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface OGPData {
  ogImage: string | null;
}

const fetchOGPData = async (url: string): Promise<OGPData> => {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Error fetching URL: ${response.statusText}`);

    const html = await response.text();
    const dom = new JSDOM(html);
    const document = dom.window.document;

    const getMetaContent = (property: string): string | null => {
      const element = document.querySelector(`meta[property='${property}']`);
      return element ? element.getAttribute('content') : null;
    };

    return { ogImage: getMetaContent('og:image') };
  } catch (error) {
    console.error(`Error fetching OGP data for ${url}:`, error);
    return { ogImage: null };
  }
};

const fetchRSSFeed = async () => {
  const feedUrl = 'https://zenn.dev/zenn/feed';

  try {
    const hostname = new URL(feedUrl).hostname;
    const media = await prisma.media.findUnique({ where: { hostname: hostname } });

    if (!media) throw new Error('Media not found');

    const response = await fetch(feedUrl);
    if (!response.ok) throw new Error(`Error fetching RSS feed: ${response.statusText}`);

    const xmlText = await response.text();
    const dom = new JSDOM(xmlText, { contentType: 'text/xml' });
    const document = dom.window.document;

    const items = await Promise.all(
      Array.from(document.querySelectorAll(media.item_selector)).map(async (item) => {
        const title = item.querySelector(media.item_title_selector)?.textContent || '';
        const link = item.querySelector(media.item_link_selector)?.textContent || '';
        const description = item.querySelector(media.item_desc_selector)?.textContent || '';
        const pubDate = item.querySelector(media.item_pubdate_selector)?.textContent || '';

        const ogpData = link ? await fetchOGPData(link) : { ogImage: null };

        return { title, link, description, pubDate, ...ogpData };
      })
    );

    const feed = {
      mediaId: media.id,
      feed: {
        title: document.querySelector(media.feed_title_selector)?.textContent || 'No title',
        description: document.querySelector(media.feed_desc_selector)?.textContent || 'No description',
        lastUpdated: document.querySelector(media.feed_last_updated_selector)?.textContent || 'No date',
      },
      items,
    };

    console.log(JSON.stringify(feed, null, 2));
  } catch (error) {
    console.error('Error: ', error instanceof Error ? error.message : String(error));
  } finally {
    await prisma.$disconnect();
  }
};

fetchRSSFeed();
