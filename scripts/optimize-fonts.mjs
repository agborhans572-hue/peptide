import subsetFont from 'subset-font'
import { readFile, writeFile } from 'node:fs/promises'
import { compress } from 'wawoff2'

for (const name of ['dune-rise', 'poppins-300', 'poppins-400', 'poppins-500', 'poppins-600', 'poppins-700']) {
  const source = await readFile(`public/assets/${name}.ttf`)
  const compressed = await compress(source)
  await writeFile(`public/assets/${name}.woff2`, compressed)
  if (name.startsWith('poppins')) {
    const ranges = [[0, 0x24f], [0x2000, 0x206f], [0x20a0, 0x20cf], [0x2100, 0x214f], [0x2190, 0x22ff]]
    const characters = ranges.flatMap(([min, max]) => Array.from({ length: max - min + 1 }, (_, i) => String.fromCodePoint(min + i))).join('')
    const subset = await subsetFont(source, characters, { targetFormat: 'woff2' })
    await writeFile('public/assets/' + name + '.latin.woff2', subset)
    console.log(name + ' Latin subset: ' + subset.length + ' bytes')
  }
  console.log(`${name}: ${source.length} → ${compressed.length} bytes`)
}
