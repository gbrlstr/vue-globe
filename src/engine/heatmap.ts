import { CanvasTexture, ClampToEdgeWrapping, NearestFilter, RepeatWrapping, Vector2 } from 'three'

export class HeatMap {
  readonly texture: CanvasTexture
  private readonly cols: number
  private readonly rows: number
  private readonly heat: Float32Array
  private readonly image: ImageData
  private readonly ctx: CanvasRenderingContext2D

  constructor(
    lngSpacing = 9,
    latSpacing = 6,
    private readonly decay = 0.96,
    private readonly strength = 0.6,
  ) {
    this.cols = Math.ceil(360 / lngSpacing)
    this.rows = Math.ceil(180 / latSpacing)
    this.heat = new Float32Array(this.cols * this.rows)

    const canvas = document.createElement('canvas')
    canvas.width = this.cols
    canvas.height = this.rows
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D indisponível')
    this.ctx = ctx
    this.image = ctx.createImageData(this.cols, this.rows)

    this.texture = new CanvasTexture(canvas)
    this.texture.minFilter = NearestFilter
    this.texture.magFilter = NearestFilter
    this.texture.wrapS = RepeatWrapping
    this.texture.wrapT = ClampToEdgeWrapping
    this.texture.flipY = false
  }

  update(mouseUV: Vector2 | null) {
    for (let i = 0; i < this.heat.length; i++) {
      const next = this.heat[i]! * this.decay
      this.heat[i] = next < 0.001 ? 0 : next
    }

    if (mouseUV && mouseUV.x >= 0) {
      const col = Math.floor(mouseUV.x * this.cols) % this.cols
      const row = Math.max(0, Math.min(this.rows - 1, Math.floor(mouseUV.y * this.rows)))
      const index = row * this.cols + col
      this.heat[index] = Math.min(1, (this.heat[index] ?? 0) + this.strength)
    }

    const data = this.image.data
    for (let i = 0; i < this.heat.length; i++) {
      const value = (this.heat[i]! * 255) | 0
      const pixel = i * 4
      data[pixel] = value
      data[pixel + 3] = 255
    }

    this.ctx.putImageData(this.image, 0, 0)
    this.texture.needsUpdate = true
  }

  dispose() {
    this.texture.dispose()
  }
}
