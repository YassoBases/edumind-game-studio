import { chromium, type Browser, type BrowserContext } from 'playwright';
import { env } from '../env.ts';
import { logger } from '../logger.ts';

export type PlayabilityResult = {
  ok: boolean;
  signature: string;
  errors: string[];
  warnings: string[];
};

class BrowserPool {
  private browser: Browser | null = null;
  private semaphore = 0;
  private max = env().PLAYWRIGHT_MAX_CONTEXTS;
  private waiters: Array<() => void> = [];

  async acquire(): Promise<{ browser: Browser; release: () => void }> {
    if (this.semaphore >= this.max) {
      await new Promise<void>((res) => this.waiters.push(res));
    }
    this.semaphore += 1;
    if (!this.browser) this.browser = await chromium.launch({ args: ['--no-sandbox'] });
    return {
      browser: this.browser,
      release: () => {
        this.semaphore -= 1;
        const next = this.waiters.shift();
        if (next) next();
      },
    };
  }

  async close(): Promise<void> {
    if (this.browser) await this.browser.close();
    this.browser = null;
  }
}

const pool = new BrowserPool();

export async function shutdownPlaywright(): Promise<void> {
  await pool.close();
}

export async function runPlayabilityCheck(
  html: string,
  language: 'en' | 'ar',
): Promise<PlayabilityResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { browser, release } = await pool.acquire();
  let context: BrowserContext | null = null;
  try {
    context = await browser.newContext({
      viewport: { width: 360, height: 640 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      locale: language === 'ar' ? 'ar-SA' : 'en-US',
    });
    const page = await context.newPage();
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
      if (msg.type() === 'warning') warnings.push(`console.warn: ${msg.text()}`);
    });

    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(3000);

    const sceneCheck = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      const w = window as unknown as { Phaser?: unknown; EduCore?: unknown };
      return {
        canvasOk: c instanceof HTMLCanvasElement && c.clientWidth > 0 && c.clientHeight > 0,
        phaserLoaded: typeof w.Phaser !== 'undefined',
        eduCoreLoaded: typeof w.EduCore !== 'undefined',
      };
    });

    if (!sceneCheck.canvasOk) errors.push('canvas missing or zero-sized');
    if (!sceneCheck.phaserLoaded) errors.push('Phaser global not loaded');
    if (!sceneCheck.eduCoreLoaded) errors.push('EduCore global not loaded');

    // Synthetic tap to wake any tap-gated audio context and exercise input handling.
    await page.touchscreen.tap(180, 320);
    await page.waitForTimeout(2000);

    const signature =
      errors.length === 0
        ? 'playable:ok'
        : `playability:${errors[0]?.slice(0, 60).replace(/\s+/g, '_') ?? 'unknown'}`;

    return { ok: errors.length === 0, signature, errors, warnings };
  } catch (err) {
    return {
      ok: false,
      signature: 'playwright_error',
      errors: [`runtime: ${err instanceof Error ? err.message : String(err)}`],
      warnings,
    };
  } finally {
    if (context) {
      try {
        await context.close();
      } catch (e) {
        logger.warn({ err: e }, 'playwright.context_close_failed');
      }
    }
    release();
  }
}

export function shouldRunPlayability(): boolean {
  if (env().NODE_ENV !== 'production') return true;
  return Math.random() < env().PLAYABILITY_SAMPLE_RATE_PROD;
}
