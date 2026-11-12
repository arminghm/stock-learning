# مسیر سرمایه

<div dir="rtl">

دورهٔ فارسی خودآموز از مبانی پول تا طراحی و ارزیابی سیستم معاملاتی. شامل ۴۸ درس در ۱۲ مرحله، هر درس ۴۵ دقیقه، با تمرکز بر Forex و XAU/USD و بخش‌های مستقل بورس و سرمایه‌گذاری. مثال‌ها و پروژه‌ها با دادهٔ فرضی، بازپخش یا معاملات دمو انجام می‌شوند.

- [مسیر دوره و درس اول](docs/curriculum.md)
- [راهنمای یادگیری، مرور و انتقال شواهد](docs/learning.md)
- [مدل داده و انتشار](docs/maintainer.md)
- [نشانی GitHub Pages پس از انتشار](https://arminghm.github.io/stock-learning/)

چت برنامه‌ریزی برای مسیر و ثبت شواهد است. هر درس و مرور پرامپت یک چت مستقل دارد. پس از تمرین و ارزیابی، گزارش JSON را دستی به داشبورد بیاور. ذخیرهٔ محلی، کامیت در GitHub و انتشار سایت سه وضعیت جداگانه‌اند.

</div>

## Local setup

Node.js 22 or newer. No dependencies to install.

```sh
npm run dev
npm run validate
npm test
npm run build
```

Visit the local URL printed by the dev server. The deployment artifact is written to `dist/`.

## GitHub Pages

In **Settings → Pages → Build and deployment → Source**, choose **GitHub Actions**. The [workflow](.github/workflows/pages.yml) validates, tests and builds on PRs to `main`. Push to `main` or use **Actions → Validate and deploy GitHub Pages → Run workflow** on `main` to publish. Verify the job's reported URL and open the site before considering it live. [GitHub Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
