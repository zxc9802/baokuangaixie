import { createUsageReporter } from '../src/lib/openlux-usage.ts';
await createUsageReporter({tool:'baokuangaixie',getMainAppUrl:()=>process.env.MAIN_APP_URL?.trim() || 'https://www.qycm.top'}).flush();
