const base = require('./lighthouserc.json');

module.exports = {
  ci: {
    ...base.ci,
    collect: {
      ...base.ci.collect,
      settings: { ...base.ci.collect.settings, preset: 'desktop' },
    },
    upload: { ...base.ci.upload, outputDir: 'reports/lighthouse-desktop' },
  },
};
