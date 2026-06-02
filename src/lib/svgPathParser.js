// Convert SVG path string to opentype.js path commands.
// scale: pixels-to-font-units multiplier
// baseline: canvas y-pixel of the baseline (maps to font y=0)
// y is flipped: font_y = (baseline - canvas_y) * scale
export function svgPathToCommands(d, height, scale = 1, baseline = height) {
  const commands = []
  const re = /([MLCQZmlcqz])([^MLCQZmlcqz]*)/g
  let match

  function fx(v) { return Math.round(v * scale) }
  function fy(v) { return Math.round((baseline - v) * scale) }

  while ((match = re.exec(d)) !== null) {
    const type = match[1].toUpperCase()
    const nums = match[2].trim().split(/[\s,]+/).filter(Boolean).map(Number)

    if (type === 'Z') {
      commands.push({ type: 'Z' })
    } else if (type === 'M' || type === 'L') {
      commands.push({ type, x: fx(nums[0]), y: fy(nums[1]) })
    } else if (type === 'C') {
      commands.push({
        type: 'C',
        x1: fx(nums[0]), y1: fy(nums[1]),
        x2: fx(nums[2]), y2: fy(nums[3]),
        x:  fx(nums[4]), y:  fy(nums[5]),
      })
    } else if (type === 'Q') {
      const qx1 = fx(nums[0]), qy1 = fy(nums[1])
      const qx  = fx(nums[2]), qy  = fy(nums[3])
      const prev = commands[commands.length - 1]
      const px = prev?.x ?? 0, py = prev?.y ?? 0
      commands.push({
        type: 'C',
        x1: px  + (2/3) * (qx1 - px),
        y1: py  + (2/3) * (qy1 - py),
        x2: qx  + (2/3) * (qx1 - qx),
        y2: qy  + (2/3) * (qy1 - qy),
        x: qx, y: qy,
      })
    }
  }

  return commands
}
