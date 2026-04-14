export const config = {
  github: {
    token: process.env.GITHUB_TOKEN ?? '',
    username: process.env.GITHUB_USERNAME ?? '',
  },
  lark: {
    appId: process.env.LARK_APP_ID ?? '',
    appSecret: process.env.LARK_APP_SECRET ?? '',
    botWebhook: process.env.LARK_BOT_WEBHOOK ?? '',
    wikiSpaceId: process.env.LARK_WIKI_SPACE_ID ?? '',
  },
  zhipu: {
    apiKey: process.env.ZHIPU_API_KEY ?? '',
    model: process.env.ZHIPU_MODEL ?? 'glm-5',
  },
  report: {
    outputDir: process.env.REPORT_OUTPUT_DIR ?? './reports',
  },
  cron: {
    schedule: process.env.CRON_SCHEDULE ?? '0 18 * * 5',
    secret: process.env.CRON_SECRET ?? '',
  },
};
