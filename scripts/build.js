import esbuild from 'esbuild';

console.log('Building extension bundles...');

try {
  await esbuild.build({
    entryPoints: [
      { in: 'src/content/content.js', out: 'content/content.bundle' },
      { in: 'src/popup/popup.js', out: 'popup/popup.bundle' },
      { in: 'src/options/options.js', out: 'options/options.bundle' },
    ],
    bundle: true,
    outdir: 'src',
    format: 'iife',
    target: ['chrome100'],
  });
  console.log('Build completed successfully.');
} catch (err) {
  console.error('Build failed:', err);
  process.exit(1);
}
