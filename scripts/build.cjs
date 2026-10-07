// Emit the standalone game to stdout. Source files stay readable; the delivered
// HTML embeds everything and needs no server, fonts, scripts, or map downloads.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, 'src', name), 'utf8');
const page = read('index.html');
const scriptTags = /<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g;
const files = [...page.matchAll(scriptTags)].map((match) => match[1]);
const script = files.map(read).join('\n\n');
let embedded = false;
const html = page
  .replace(
    /<link\b[^>]*href="styles\/game.css"[^>]*>/,
    () => `<style>\n${read('styles/game.css')}\n</style>`,
  )
  .replace(scriptTags, () => {
    if (embedded) return '';
    embedded = true;
    return `<script>\n${script.replace(/<\/script/gi, '<\\/script')}\n</script>`;
  });
if (process.argv.includes('--write')) {
  fs.writeFileSync(path.join(root, 'index.html'), html);
  fs.writeFileSync(path.join(root, 'geotrivia.html'), html);
  fs.mkdirSync(path.join(root, 'publish'), { recursive: true });
  fs.writeFileSync(path.join(root, 'publish/index.html'), html);
  console.log('Built index.html, geotrivia.html, and publish/index.html from the organized source files.');
} else process.stdout.write(html);
