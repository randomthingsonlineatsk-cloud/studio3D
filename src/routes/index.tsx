import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'

export const Route = createFileRoute('/')({ component: Page })

const FEEDBACK_EMAIL = 'shagufa.khan0944@gmail.com'
const FEEDBACK_HREF = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent('Studio3D Feedback')}&body=${encodeURIComponent('Hi Shagufa,\n\nI was using Studio3D and wanted to share:\n\n')}`

function Page() {
  const [entered, setEntered] = useState(false)
  if (!entered) return <LandingScreen onLaunch={() => setEntered(true)} />
  return <StudioApp />
}

function LandingScreen({ onLaunch }: { onLaunch: () => void }) {
  return (
    <div className="dark flex h-screen w-full flex-col items-center justify-center bg-background p-6 text-center text-foreground">
      <div className="max-w-md">
        <div className="mb-3 text-5xl">🧊</div>
        <h1 className="mb-2 text-2xl font-bold">Studio3D</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          A free 3D massing &amp; visualization sketchpad for architecture and CAD students.
        </p>
        <span className="mb-6 inline-block rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
          100% Free — always
        </span>
        <ul className="mb-7 space-y-1.5 text-left text-sm text-muted-foreground">
          <li>• Block out buildings, rooms, and site context in real 3D</li>
          <li>• Sketch a footprint or wall and extrude it, or drop in ready-made shapes</li>
          <li>• Measure distances with an X / Y / Z breakdown</li>
          <li>• Export a PNG render or a real OBJ file for other software</li>
        </ul>
        <button
          onClick={onLaunch}
          className="mb-3 w-full rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          🚀 Launch Studio3D
        </button>
        <a href={FEEDBACK_HREF} className="text-xs text-muted-foreground underline hover:text-foreground">
          💬 Send feedback or report a bug
        </a>
      </div>
    </div>
  )
}

type ShapeType =
  | 'box'
  | 'cylinder'
  | 'cone'
  | 'sphere'
  | 'plane'
  | 'extrude'
  | 'wall'
  | 'tree'
  | 'car'
  | 'car_suv'
  | 'person'
  | 'window'
  | 'door'
  | 'staircase'
  | 'light'
  | 'pipe'
  | 'sofa'
  | 'bed'
  | 'toilet'
  | 'bathtub'
  | 'kitchen_counter'
  | 'dining_table'
  | 'chair'
  | 'fridge'
  | 'washing_machine'
  | 'sink'

type SketchMode = 'none' | 'polygon' | 'circle' | 'measure' | 'wall'
type MaterialPresetKey = 'concrete' | 'glass' | 'brick' | 'wood' | 'steel' | 'grass'

interface SceneRefs {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  controls: OrbitControls
  objects: THREE.Object3D[]
  outline: THREE.BoxHelper | null
  sketchGroup: THREE.Group
  measurementGroup: THREE.Group
  groundPlane: THREE.Plane
}

interface SavedObjectData {
  type: ShapeType
  x: number
  y: number
  z: number
  sx: number
  sy: number
  sz: number
  ry: number
  color: string
  footprint?: { x: number; z: number }[]
  footprintHeight?: number
}

const SWATCHES = ['#4f9dff', '#ff5555', '#55ff8a', '#ffd23f', '#ffffff', '#ff9f43', '#c77dff']
const GROUND_BASE_TYPES: ShapeType[] = ['box', 'cylinder', 'cone', 'sphere']
const SPECIAL_BASE_Y: Partial<Record<ShapeType, number>> = { window: 1.0, light: 2.6 }
const NICE_LABELS: Partial<Record<ShapeType, string>> = {
  kitchen_counter: 'Kitchen Counter',
  dining_table: 'Dining Table',
  washing_machine: 'Washing Machine',
  car_suv: 'SUV',
  extrude: 'Footprint',
  wall: 'Wall',
}

const MATERIAL_PRESETS: Record<MaterialPresetKey, { color: string; roughness: number; metalness: number; transparent?: boolean; opacity?: number }> = {
  concrete: { color: '#b0b0ab', roughness: 0.9, metalness: 0.05 },
  glass: { color: '#bfe6ff', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.35 },
  brick: { color: '#a63a2e', roughness: 0.95, metalness: 0 },
  wood: { color: '#8d6e63', roughness: 0.7, metalness: 0 },
  steel: { color: '#b5b8bb', roughness: 0.3, metalness: 0.85 },
  grass: { color: '#4caf50', roughness: 1, metalness: 0 },
}

function labelFor(type: ShapeType): string {
  return NICE_LABELS[type] || type.charAt(0).toUpperCase() + type.slice(1)
}

function shadowify(obj: THREE.Object3D) {
  obj.traverse((c) => {
    if (c instanceof THREE.Mesh) {
      c.castShadow = true
      c.receiveShadow = true
    }
  })
}

function collectMaterials(obj: THREE.Object3D): THREE.MeshStandardMaterial[] {
  const result: THREE.MeshStandardMaterial[] = []
  obj.traverse((c) => {
    if (c instanceof THREE.Mesh && c.material instanceof THREE.MeshStandardMaterial) result.push(c.material)
  })
  return result
}

function createExtrudeGeometry(points: { x: number; z: number }[], height: number) {
  const shape = new THREE.Shape(points.map((p) => new THREE.Vector2(p.x, -p.z)))
  const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false })
  geo.rotateX(-Math.PI / 2)
  return geo
}

function makeTextSprite(lines: string[]): THREE.Sprite {
  const canvas = document.createElement('canvas')
  const lineHeight = 34
  canvas.width = 340
  canvas.height = lineHeight * lines.length + 20
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = 'rgba(0,0,0,0.7)'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.font = 'bold 24px sans-serif'
  ctx.fillStyle = '#ffd23f'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  lines.forEach((line, i) => {
    ctx.fillText(line, canvas.width / 2, 10 + lineHeight * i + lineHeight / 2)
  })
  const texture = new THREE.CanvasTexture(canvas)
  const material = new THREE.SpriteMaterial({ map: texture, depthTest: false })
  const sprite = new THREE.Sprite(material)
  const aspect = canvas.width / canvas.height
  const spriteHeight = 0.22 * lines.length + 0.1
  sprite.scale.set(spriteHeight * aspect, spriteHeight, 1)
  return sprite
}

function addMeasurementVisual(group: THREE.Group, p1: THREE.Vector3, p2: THREE.Vector3) {
  const total = p1.distanceTo(p2)
  const dx = Math.abs(p2.x - p1.x)
  const dy = Math.abs(p2.y - p1.y)
  const dz = Math.abs(p2.z - p1.z)
  const lineGeo = new THREE.BufferGeometry().setFromPoints([p1, p2])
  const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xffd23f }))
  group.add(line)
  const dotGeo = new THREE.SphereGeometry(0.06, 10, 8)
  const dotMat = new THREE.MeshBasicMaterial({ color: 0xffd23f })
  const d1 = new THREE.Mesh(dotGeo, dotMat)
  d1.position.copy(p1)
  const d2 = new THREE.Mesh(dotGeo, dotMat)
  d2.position.copy(p2)
  group.add(d1, d2)
  const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5)
  mid.y += 0.35
  const label = makeTextSprite([
    `Total: ${total.toFixed(2)} m`,
    `X: ${dx.toFixed(2)}  Y: ${dy.toFixed(2)}  Z: ${dz.toFixed(2)}`,
  ])
  label.position.copy(mid)
  group.add(label)
}

// ---- Compound object builders (simplified, real-world scaled in meters) ----
function buildTree(color?: string) {
  const group = new THREE.Group()
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.16, 1.0, 8),
    new THREE.MeshStandardMaterial({ color: '#6d4c33', roughness: 0.9 })
  )
  trunk.position.y = 0.5
  const foliage = new THREE.Mesh(
    new THREE.ConeGeometry(0.9, 1.8, 10),
    new THREE.MeshStandardMaterial({ color: color || '#2e7d32', roughness: 0.8 })
  )
  foliage.position.y = 1.9
  group.add(trunk, foliage)
  return group
}

function buildCar(color?: string) {
  const group = new THREE.Group()
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(4.2, 0.9, 1.8),
    new THREE.MeshStandardMaterial({ color: color || '#c62828', roughness: 0.4, metalness: 0.3 })
  )
  body.position.y = 0.55
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.6, 1.6),
    new THREE.MeshStandardMaterial({ color: '#222222', roughness: 0.3 })
  )
  cabin.position.set(-0.2, 1.15, 0)
  group.add(body, cabin)
  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.25, 16)
  const wheelMat = new THREE.MeshStandardMaterial({ color: '#111111' })
  ;([[1.4, 0.85], [1.4, -0.85], [-1.4, 0.85], [-1.4, -0.85]] as [number, number][]).forEach(([x, z]) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat)
    wheel.rotation.z = Math.PI / 2
    wheel.position.set(x, 0.32, z)
    group.add(wheel)
  })
  return group
}

function buildSUV(color?: string) {
  const group = new THREE.Group()
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(4.6, 1.3, 1.9),
    new THREE.MeshStandardMaterial({ color: color || '#37474f', roughness: 0.4, metalness: 0.3 })
  )
  body.position.y = 0.75
  group.add(body)
  const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.28, 16)
  const wheelMat = new THREE.MeshStandardMaterial({ color: '#111111' })
  ;([[1.5, 0.9], [1.5, -0.9], [-1.5, 0.9], [-1.5, -0.9]] as [number, number][]).forEach(([x, z]) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat)
    wheel.rotation.z = Math.PI / 2
    wheel.position.set(x, 0.35, z)
    group.add(wheel)
  })
  return group
}

function buildPerson(color?: string) {
  const group = new THREE.Group()
  const clothes = new THREE.MeshStandardMaterial({ color: color || '#5c6bc0' })
  const skin = new THREE.MeshStandardMaterial({ color: '#e0ac69' })
  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.9, 8), clothes)
  legs.position.y = 0.45
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.55, 4, 8), clothes)
  body.position.y = 1.05
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), skin)
  head.position.y = 1.55
  group.add(legs, body, head)
  return group
}

function buildWindow(color?: string) {
  const group = new THREE.Group()
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 1.2, 0.1),
    new THREE.MeshStandardMaterial({ color: '#5d4a3a', roughness: 0.7 })
  )
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(1.05, 1.05, 0.04),
    new THREE.MeshStandardMaterial({ color: color || '#bfe6ff', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.4 })
  )
  glass.position.z = 0.02
  group.add(frame, glass)
  return group
}

function buildDoor(color?: string) {
  const group = new THREE.Group()
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 2.1, 0.08),
    new THREE.MeshStandardMaterial({ color: '#5d4a3a', roughness: 0.7 })
  )
  frame.position.y = 1.05
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(0.86, 2.0, 0.04),
    new THREE.MeshStandardMaterial({ color: color || '#8d6e63', roughness: 0.6 })
  )
  panel.position.set(0, 1.05, 0.02)
  const knob = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 8, 8),
    new THREE.MeshStandardMaterial({ color: '#d4af37', metalness: 0.8, roughness: 0.3 })
  )
  knob.position.set(0.35, 1.0, 0.05)
  group.add(frame, panel, knob)
  return group
}

function buildStaircase(color?: string) {
  const group = new THREE.Group()
  const mat = new THREE.MeshStandardMaterial({ color: color || '#a1887f', roughness: 0.8 })
  const steps = 10
  const stepHeight = 0.18
  const stepDepth = 0.28
  const width = 1.0
  for (let i = 0; i < steps; i++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(width, stepHeight, stepDepth), mat)
    step.position.set(0, stepHeight * (i + 0.5), -stepDepth * i)
    group.add(step)
  }
  return group
}

function buildLightFixture(color?: string) {
  const group = new THREE.Group()
  const c = color || '#fff4d6'
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 12, 10),
    new THREE.MeshStandardMaterial({ color: c, emissive: new THREE.Color(c), emissiveIntensity: 0.9, roughness: 0.4 })
  )
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.3, 6), new THREE.MeshStandardMaterial({ color: '#333333' }))
  cord.position.y = 0.15
  group.add(cord, bulb)
  const light = new THREE.PointLight(new THREE.Color(c), 1.2, 8, 2)
  group.add(light)
  return group
}

function buildPipe(color?: string) {
  const group = new THREE.Group()
  const pipe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 2.0, 16),
    new THREE.MeshStandardMaterial({ color: color || '#8c8c8c', metalness: 0.6, roughness: 0.4 })
  )
  pipe.rotation.z = Math.PI / 2
  pipe.position.y = 0.06
  group.add(pipe)
  return group
}

function buildSofa(color?: string) {
  const group = new THREE.Group()
  const mat = new THREE.MeshStandardMaterial({ color: color || '#8d6e63', roughness: 0.9 })
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.4, 0.9), mat)
  base.position.y = 0.2
  const back = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.5, 0.2), mat)
  back.position.set(0, 0.65, -0.35)
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.9), mat)
  armL.position.set(-0.9, 0.45, 0)
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.9), mat)
  armR.position.set(0.9, 0.45, 0)
  group.add(base, back, armL, armR)
  return group
}

function buildBed(color?: string) {
  const group = new THREE.Group()
  const frameMat = new THREE.MeshStandardMaterial({ color: '#8d6e63' })
  const mattressMat = new THREE.MeshStandardMaterial({ color: color || '#eceff1' })
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.25, 2.0), frameMat)
  frame.position.y = 0.125
  const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.25, 1.9), mattressMat)
  mattress.position.y = 0.375
  const headboard = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 0.1), frameMat)
  headboard.position.set(0, 0.5, -0.95)
  group.add(frame, mattress, headboard)
  return group
}

function buildToilet(color?: string) {
  const group = new THREE.Group()
  const mat = new THREE.MeshStandardMaterial({ color: color || '#f5f5f5', roughness: 0.3 })
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.4, 16), mat)
  base.position.y = 0.2
  const bowl = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.15, 0.55), mat)
  bowl.position.y = 0.42
  const tank = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.4, 0.18), mat)
  tank.position.set(0, 0.65, -0.22)
  group.add(base, bowl, tank)
  return group
}

function buildBathtub(color?: string) {
  const group = new THREE.Group()
  const mat = new THREE.MeshStandardMaterial({ color: color || '#ffffff', roughness: 0.2 })
  const tub = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 0.75), mat)
  tub.position.y = 0.275
  group.add(tub)
  return group
}

function buildKitchenCounter(color?: string) {
  const group = new THREE.Group()
  const cabinetMat = new THREE.MeshStandardMaterial({ color: color || '#d7ccc8' })
  const topMat = new THREE.MeshStandardMaterial({ color: '#333333' })
  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.85, 0.6), cabinetMat)
  cabinet.position.y = 0.425
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.05, 0.65), topMat)
  top.position.y = 0.875
  group.add(cabinet, top)
  return group
}

function buildDiningTable(color?: string) {
  const group = new THREE.Group()
  const mat = new THREE.MeshStandardMaterial({ color: color || '#8d6e63' })
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.8), mat)
  top.position.y = 0.75
  const legGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.75, 8)
  ;([[0.6, 0.35], [0.6, -0.35], [-0.6, 0.35], [-0.6, -0.35]] as [number, number][]).forEach(([x, z]) => {
    const leg = new THREE.Mesh(legGeo, mat)
    leg.position.set(x, 0.375, z)
    group.add(leg)
  })
  group.add(top)
  return group
}

function buildChair(color?: string) {
  const group = new THREE.Group()
  const mat = new THREE.MeshStandardMaterial({ color: color || '#5c6bc0' })
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.05, 0.45), mat)
  seat.position.y = 0.45
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.5, 0.05), mat)
  back.position.set(0, 0.7, -0.2)
  const legGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.45, 6)
  ;([[0.18, 0.18], [0.18, -0.18], [-0.18, 0.18], [-0.18, -0.18]] as [number, number][]).forEach(([x, z]) => {
    const leg = new THREE.Mesh(legGeo, mat)
    leg.position.set(x, 0.225, z)
    group.add(leg)
  })
  group.add(seat, back)
  return group
}

function buildFridge(color?: string) {
  const group = new THREE.Group()
  const mat = new THREE.MeshStandardMaterial({ color: color || '#e8e8e8', roughness: 0.3, metalness: 0.4 })
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.8, 0.7), mat)
  body.position.y = 0.9
  const handle = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.5, 0.04),
    new THREE.MeshStandardMaterial({ color: '#888888', metalness: 0.6 })
  )
  handle.position.set(0.3, 1.1, 0.37)
  group.add(body, handle)
  return group
}

function buildWashingMachine(color?: string) {
  const group = new THREE.Group()
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.85, 0.6),
    new THREE.MeshStandardMaterial({ color: color || '#f2f2f2', roughness: 0.4 })
  )
  body.position.y = 0.425
  const door = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 0.05, 24),
    new THREE.MeshStandardMaterial({ color: '#333333', roughness: 0.2, metalness: 0.3 })
  )
  door.rotation.x = Math.PI / 2
  door.position.set(0, 0.425, 0.33)
  group.add(body, door)
  return group
}

function buildSink(color?: string) {
  const group = new THREE.Group()
  const counter = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.05, 0.5),
    new THREE.MeshStandardMaterial({ color: color || '#e0e0e0', roughness: 0.3 })
  )
  counter.position.y = 0.85
  const basin = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.15, 0.35),
    new THREE.MeshStandardMaterial({ color: '#cfcfcf', roughness: 0.2, metalness: 0.2 })
  )
  basin.position.y = 0.77
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.1, 0.8, 12),
    new THREE.MeshStandardMaterial({ color: '#dddddd' })
  )
  pedestal.position.y = 0.4
  const faucet = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.25, 8),
    new THREE.MeshStandardMaterial({ color: '#999999', metalness: 0.7, roughness: 0.2 })
  )
  faucet.position.set(0, 0.98, -0.15)
  group.add(counter, basin, pedestal, faucet)
  return group
}

function createObject(type: ShapeType, color?: string): THREE.Object3D {
  let obj: THREE.Object3D
  switch (type) {
    case 'box':
      obj = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: color || '#4f9dff', roughness: 0.6, metalness: 0.05 }))
      break
    case 'cylinder':
      obj = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 32), new THREE.MeshStandardMaterial({ color: color || '#4f9dff', roughness: 0.6 }))
      break
    case 'cone':
      obj = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1, 32), new THREE.MeshStandardMaterial({ color: color || '#4f9dff', roughness: 0.6 }))
      break
    case 'sphere':
      obj = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 24), new THREE.MeshStandardMaterial({ color: color || '#4f9dff', roughness: 0.6 }))
      break
    case 'plane':
      obj = new THREE.Mesh(new THREE.BoxGeometry(2, 0.1, 2), new THREE.MeshStandardMaterial({ color: color || '#4f9dff', roughness: 0.6 }))
      break
    case 'wall':
      obj = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: color || '#cfcfcf', roughness: 0.85 }))
      break
    case 'tree':
      obj = buildTree(color)
      break
    case 'car':
      obj = buildCar(color)
      break
    case 'car_suv':
      obj = buildSUV(color)
      break
    case 'person':
      obj = buildPerson(color)
      break
    case 'window':
      obj = buildWindow(color)
      break
    case 'door':
      obj = buildDoor(color)
      break
    case 'staircase':
      obj = buildStaircase(color)
      break
    case 'light':
      obj = buildLightFixture(color)
      break
    case 'pipe':
      obj = buildPipe(color)
      break
    case 'sofa':
      obj = buildSofa(color)
      break
    case 'bed':
      obj = buildBed(color)
      break
    case 'toilet':
      obj = buildToilet(color)
      break
    case 'bathtub':
      obj = buildBathtub(color)
      break
    case 'kitchen_counter':
      obj = buildKitchenCounter(color)
      break
    case 'dining_table':
      obj = buildDiningTable(color)
      break
    case 'chair':
      obj = buildChair(color)
      break
    case 'fridge':
      obj = buildFridge(color)
      break
    case 'washing_machine':
      obj = buildWashingMachine(color)
      break
    case 'sink':
      obj = buildSink(color)
      break
    default:
      obj = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: color || '#4f9dff' }))
  }
  shadowify(obj)
  obj.userData = { shapeType: type }
  return obj
}

const ONBOARD_KEY = 'studio3d_onboarded_v1'
const ONBOARD_STEPS = [
  { title: 'Add a shape', body: 'Use the left sidebar to drop in boxes, furniture, trees, cars, windows, doors — anything you need.' },
  { title: 'Click to select', body: 'Click any object in the 3D view to select it and edit its size, position, rotation, and material.' },
  { title: 'Drag or nudge to move', body: 'Drag a selected object to slide it across the ground, or use arrow keys (PageUp/PageDown for height).' },
  { title: 'Sketch a footprint or wall', body: 'Use Footprint, Circle, or Wall under Draw & Measure to trace a building outline and turn it into 3D.' },
]

function StudioApp() {
  const viewportRef = useRef<HTMLDivElement>(null)
  const refs = useRef<SceneRefs | null>(null)
  const [selected, setSelected] = useState<THREE.Object3D | null>(null)
  const [, forceRerender] = useState(0)
  const [status, setStatus] = useState('Click an object to select it. Drag it to move, or use arrow keys.')
  const sketchModeRef = useRef<SketchMode>('none')
  const [sketchMode, setSketchModeState] = useState<SketchMode>('none')
  const sketchPointsRef = useRef<THREE.Vector3[]>([])
  const [polygonPointCount, setPolygonPointCount] = useState(0)
  const typeCounters = useRef<Record<string, number>>({})
  const undoStack = useRef<SavedObjectData[][]>([])
  const redoStack = useRef<SavedObjectData[][]>([])
  const selectedRef = useRef<THREE.Object3D | null>(null)
  const isDraggingRef = useRef(false)
  const draggedThisDownRef = useRef(false)
  const dragPlaneRef = useRef(new THREE.Plane())
  const dragOffsetRef = useRef(new THREE.Vector3())
  const dragStartScreenRef = useRef({ x: 0, y: 0 })
  const finishPolygonRef = useRef<(() => void) | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try {
      return !localStorage.getItem(ONBOARD_KEY)
    } catch {
      return true
    }
  })
  const [onboardStep, setOnboardStep] = useState(0)

  function dismissOnboarding() {
    try {
      localStorage.setItem(ONBOARD_KEY, '1')
    } catch {
      /* ignore */
    }
    setShowOnboarding(false)
  }

  function setSketchMode(mode: SketchMode) {
    sketchModeRef.current = mode
    setSketchModeState(mode)
    sketchPointsRef.current = []
    setPolygonPointCount(0)
    clearSketchPreview()
    if (mode === 'none') setStatus('Click an object to select it. Drag it to move, or use arrow keys.')
    else if (mode === 'polygon')
      setStatus('Click points on the ground. Press Enter or use "Finish Shape" when done (3+ points).')
    else if (mode === 'circle') setStatus('Click the center of the circle, then click again to set its radius.')
    else if (mode === 'wall') setStatus('Click the wall\u2019s start point, then click its end point.')
    else setStatus('Click a point (on the ground or on an object surface), then click a second point to measure X/Y/Z.')
  }

  function clearSketchPreview() {
    const r = refs.current
    if (!r) return
    r.sketchGroup.clear()
  }

  function nameObject(obj: THREE.Object3D, type: ShapeType) {
    typeCounters.current[type] = (typeCounters.current[type] || 0) + 1
    obj.name = `${labelFor(type)} ${typeCounters.current[type]}`
  }

  function snapshotScene(): SavedObjectData[] {
    const r = refs.current
    if (!r) return []
    return r.objects.map((o) => {
      const mats = collectMaterials(o)
      const base: SavedObjectData = {
        type: o.userData.shapeType,
        x: o.position.x,
        y: o.position.y,
        z: o.position.z,
        sx: o.scale.x,
        sy: o.scale.y,
        sz: o.scale.z,
        ry: (o.rotation.y * 180) / Math.PI,
        color: mats[0] ? '#' + mats[0].color.getHexString() : '#4f9dff',
      }
      if (o.userData.shapeType === 'extrude') {
        base.footprint = o.userData.footprint
        base.footprintHeight = o.userData.footprintHeight
      }
      return base
    })
  }

  function pushHistory() {
    undoStack.current.push(snapshotScene())
    redoStack.current = []
    forceRerender((n) => n + 1)
  }

  function restoreScene(snapshot: SavedObjectData[]) {
    const r = refs.current
    if (!r) return
    if (r.outline) {
      r.scene.remove(r.outline)
      r.outline = null
    }
    r.objects.forEach((o) => r.scene.remove(o))
    r.objects = []
    snapshot.forEach((d) => {
      const obj = reconstructObject(d)
      r.scene.add(obj)
      r.objects.push(obj)
    })
    setSelected(null)
    selectedRef.current = null
    forceRerender((n) => n + 1)
  }

  function handleUndo() {
    if (undoStack.current.length === 0) return
    const prev = undoStack.current.pop()!
    redoStack.current.push(snapshotScene())
    restoreScene(prev)
  }
  function handleRedo() {
    if (redoStack.current.length === 0) return
    const next = redoStack.current.pop()!
    undoStack.current.push(snapshotScene())
    restoreScene(next)
  }

  function nudgeSelected(dx: number, dy: number, dz: number) {
    const obj = selectedRef.current
    if (!obj) return
    obj.position.x += dx
    obj.position.y = Math.max(0, obj.position.y + dy)
    obj.position.z += dz
    refs.current?.outline?.update()
    forceRerender((n) => n + 1)
  }

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a1a1a)

    const width = viewport.clientWidth
    const height = viewport.clientHeight
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 3000)
    camera.position.set(8, 7, 8)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.shadowMap.enabled = true
    viewport.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 1, 0)
    controls.enableDamping = true
    controls.screenSpacePanning = true
    controls.minDistance = 0.5
    controls.maxDistance = 2000
    // Left-drag pans sideways (matches expectation of a drawing/planning tool);
    // right-drag orbits/rotates the view instead.
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    }
    controls.touches = {
      ONE: THREE.TOUCH.PAN,
      TWO: THREE.TOUCH.DOLLY_ROTATE,
    }

    scene.add(new THREE.AmbientLight(0xffffff, 0.5))
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0)
    dirLight.position.set(10, 15, 8)
    dirLight.castShadow = true
    dirLight.shadow.mapSize.set(2048, 2048)
    dirLight.shadow.camera.left = -20
    dirLight.shadow.camera.right = 20
    dirLight.shadow.camera.top = 20
    dirLight.shadow.camera.bottom = -20
    scene.add(dirLight)

    // Grid + ground recenter under the camera's look-at target every frame, snapped to
    // the grid cell size, so it always fills the view and reads as an infinite plane
    // instead of a fixed patch you can pan off the edge of.
    const gridCell = 2
    const gridHelper = new THREE.GridHelper(400, 200, 0x444444, 0x2a2a2a)
    scene.add(gridHelper)
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(500, 500),
      new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 1 })
    )
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    ground.position.y = -0.001
    scene.add(ground)

    const sketchGroup = new THREE.Group()
    scene.add(sketchGroup)
    const measurementGroup = new THREE.Group()
    scene.add(measurementGroup)

    refs.current = {
      scene,
      camera,
      renderer,
      controls,
      objects: [],
      outline: null,
      sketchGroup,
      measurementGroup,
      groundPlane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    }

    function handleResize() {
      if (!viewport) return
      const w = viewport.clientWidth
      const h = viewport.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', handleResize)

    let raf = 0
    function animate() {
      raf = requestAnimationFrame(animate)
      controls.update()
      const cx = Math.round(controls.target.x / gridCell) * gridCell
      const cz = Math.round(controls.target.z / gridCell) * gridCell
      gridHelper.position.set(cx, 0, cz)
      ground.position.set(controls.target.x, -0.001, controls.target.z)
      renderer.render(scene, camera)
    }
    animate()

    // starting example scene
    addShapeInternal('box', { x: -1.5, y: 0.75, sy: 1.5, color: '#e0e0e0' })
    addShapeInternal('tree', { x: 3, z: 2 })
    addShapeInternal('person', { x: -3, z: -2 })

    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    function findTopLevel(o: THREE.Object3D | null): THREE.Object3D | null {
      let cur: THREE.Object3D | null = o
      while (cur) {
        if (refs.current!.objects.includes(cur)) return cur
        cur = cur.parent
      }
      return null
    }

    function getGroundPoint(e: MouseEvent): THREE.Vector3 | null {
      const rect = renderer.domElement.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(mouse, camera)
      const pt = new THREE.Vector3()
      const hit = raycaster.ray.intersectPlane(refs.current!.groundPlane, pt)
      return hit ? pt : null
    }

    // For measuring: prefer an actual point on an object's surface (so height/Y
    // differences are meaningful), falling back to the ground plane if nothing is hit.
    function getMeasurePoint(e: MouseEvent): THREE.Vector3 | null {
      const rect = renderer.domElement.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(mouse, camera)
      const hits = raycaster.intersectObjects(refs.current!.objects, true)
      if (hits.length > 0) return hits[0].point.clone()
      return getGroundPoint(e)
    }

    function redrawSketchPreview(hoverPt?: THREE.Vector3) {
      const grp = refs.current!.sketchGroup
      grp.clear()
      const pts = sketchPointsRef.current
      const dotGeo = new THREE.SphereGeometry(0.08, 12, 8)
      const dotMat = new THREE.MeshBasicMaterial({ color: 0xffd23f })
      pts.forEach((p) => {
        const dot = new THREE.Mesh(dotGeo, dotMat)
        dot.position.copy(p)
        grp.add(dot)
      })
      const linePts = [...pts]
      if (hoverPt) linePts.push(hoverPt)
      if (linePts.length >= 2) {
        const lineGeo = new THREE.BufferGeometry().setFromPoints(linePts)
        const line = new THREE.Line(lineGeo, new THREE.LineDashedMaterial({ color: 0xffd23f, dashSize: 0.15, gapSize: 0.1 }))
        line.computeLineDistances()
        grp.add(line)
      }
    }

    function finishPolygon() {
      const pts = sketchPointsRef.current
      if (pts.length < 3) return
      const heightStr = window.prompt('Height of this volume (meters)?', '3')
      const heightVal = heightStr ? parseFloat(heightStr) : NaN
      if (!heightVal || heightVal <= 0) {
        setSketchMode('none')
        return
      }
      pushHistory()
      const footprint = pts.map((p) => ({ x: p.x, z: p.z }))
      const geo = createExtrudeGeometry(footprint, heightVal)
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#e0e0e0', roughness: 0.6 }))
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.userData = { shapeType: 'extrude' as ShapeType, footprint, footprintHeight: heightVal }
      nameObject(mesh, 'extrude')
      refs.current!.scene.add(mesh)
      refs.current!.objects.push(mesh)
      selectObject(mesh)
      setSketchMode('none')
    }
    finishPolygonRef.current = finishPolygon

    function finishCircle(center: THREE.Vector3, edge: THREE.Vector3) {
      const radius = center.distanceTo(edge)
      if (radius < 0.05) {
        setSketchMode('none')
        return
      }
      const heightStr = window.prompt('Height of this volume (meters)?', '3')
      const heightVal = heightStr ? parseFloat(heightStr) : NaN
      if (!heightVal || heightVal <= 0) {
        setSketchMode('none')
        return
      }
      pushHistory()
      const sxz = radius / 0.5
      addShapeInternal('cylinder', {
        x: center.x,
        z: center.z,
        y: heightVal / 2,
        sx: sxz,
        sy: heightVal,
        sz: sxz,
        color: '#4f9dff',
      })
      setSketchMode('none')
    }

    function finishWall(p1: THREE.Vector3, p2: THREE.Vector3) {
      const dx = p2.x - p1.x
      const dz = p2.z - p1.z
      const length = Math.sqrt(dx * dx + dz * dz)
      if (length < 0.1) {
        setSketchMode('none')
        return
      }
      const heightStr = window.prompt('Wall height (meters)?', '2.7')
      const heightVal = heightStr ? parseFloat(heightStr) : NaN
      if (!heightVal || heightVal <= 0) {
        setSketchMode('none')
        return
      }
      const thicknessStr = window.prompt('Wall thickness (meters)?', '0.15')
      const thicknessVal = thicknessStr ? parseFloat(thicknessStr) : NaN
      if (!thicknessVal || thicknessVal <= 0) {
        setSketchMode('none')
        return
      }
      pushHistory()
      const angleDeg = (Math.atan2(-dz, dx) * 180) / Math.PI
      addShapeInternal('wall', {
        x: (p1.x + p2.x) / 2,
        z: (p1.z + p2.z) / 2,
        y: heightVal / 2,
        sx: length,
        sy: heightVal,
        sz: thicknessVal,
        ry: angleDeg,
        color: '#cfcfcf',
      })
      setSketchMode('none')
    }

    function onClick(e: MouseEvent) {
      const mode = sketchModeRef.current
      if (mode === 'polygon') {
        const p = getGroundPoint(e)
        if (!p) return
        const pts = sketchPointsRef.current
        if (pts.length >= 3 && p.distanceTo(pts[0]) < 0.6) {
          finishPolygon()
          return
        }
        pts.push(p)
        setPolygonPointCount(pts.length)
        redrawSketchPreview()
        return
      }
      if (mode === 'circle') {
        const p = getGroundPoint(e)
        if (!p) return
        const pts = sketchPointsRef.current
        if (pts.length === 0) {
          pts.push(p)
          redrawSketchPreview()
        } else {
          finishCircle(pts[0], p)
        }
        return
      }
      if (mode === 'wall') {
        const p = getGroundPoint(e)
        if (!p) return
        const pts = sketchPointsRef.current
        if (pts.length === 0) {
          pts.push(p)
          redrawSketchPreview()
        } else {
          finishWall(pts[0], p)
        }
        return
      }
      if (mode === 'measure') {
        const p = getMeasurePoint(e)
        if (!p) return
        const pts = sketchPointsRef.current
        if (pts.length === 0) {
          pts.push(p)
          redrawSketchPreview()
        } else {
          addMeasurementVisual(refs.current!.measurementGroup, pts[0], p)
          sketchPointsRef.current = []
          clearSketchPreview()
        }
        return
      }
      if (draggedThisDownRef.current) return
      const rect = renderer.domElement.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(mouse, camera)
      const hits = raycaster.intersectObjects(refs.current!.objects, true)
      if (hits.length > 0) {
        const top = findTopLevel(hits[0].object)
        selectObject(top)
      } else {
        selectObject(null)
      }
    }

    function onDoubleClick() {
      if (sketchModeRef.current === 'polygon' && sketchPointsRef.current.length >= 3) {
        finishPolygon()
      }
    }

    function onMouseMove(e: MouseEvent) {
      const mode = sketchModeRef.current
      if (mode === 'none') return
      const p = mode === 'measure' ? getMeasurePoint(e) : getGroundPoint(e)
      if (p) redrawSketchPreview(p)
    }

    function onPointerDown(e: PointerEvent) {
      if (sketchModeRef.current !== 'none') return
      if (e.button !== 0) return
      const rect = renderer.domElement.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(mouse, camera)
      const hits = raycaster.intersectObjects(refs.current!.objects, true)
      if (hits.length === 0) return
      const top = findTopLevel(hits[0].object)
      if (!top) return
      selectObject(top)
      isDraggingRef.current = true
      draggedThisDownRef.current = false
      dragStartScreenRef.current = { x: e.clientX, y: e.clientY }
      const y = top.position.y
      dragPlaneRef.current.set(new THREE.Vector3(0, 1, 0), -y)
      const hitPoint = new THREE.Vector3()
      const hit = raycaster.ray.intersectPlane(dragPlaneRef.current, hitPoint)
      dragOffsetRef.current.set(
        top.position.x - (hit ? hitPoint.x : top.position.x),
        0,
        top.position.z - (hit ? hitPoint.z : top.position.z)
      )
      controls.enabled = false
    }

    function onPointerMoveDrag(e: PointerEvent) {
      if (!isDraggingRef.current) return
      const obj = selectedRef.current
      if (!obj) return
      const moved = Math.hypot(e.clientX - dragStartScreenRef.current.x, e.clientY - dragStartScreenRef.current.y)
      if (!draggedThisDownRef.current && moved > 3) {
        draggedThisDownRef.current = true
        pushHistory()
      }
      if (!draggedThisDownRef.current) return
      const rect = renderer.domElement.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(mouse, camera)
      const hitPoint = new THREE.Vector3()
      const hit = raycaster.ray.intersectPlane(dragPlaneRef.current, hitPoint)
      if (hit) {
        obj.position.x = hitPoint.x + dragOffsetRef.current.x
        obj.position.z = hitPoint.z + dragOffsetRef.current.z
        refs.current?.outline?.update()
        forceRerender((n) => n + 1)
      }
    }

    function onPointerUp() {
      if (isDraggingRef.current) {
        isDraggingRef.current = false
        controls.enabled = true
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && sketchModeRef.current !== 'none') setSketchMode('none')
      if (e.key === 'Enter' && sketchModeRef.current === 'polygon' && sketchPointsRef.current.length >= 3) {
        e.preventDefault()
        finishPolygon()
        return
      }
      const cmd = e.ctrlKey || e.metaKey
      if (cmd && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        handleUndo()
        return
      }
      if (cmd && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        handleRedo()
        return
      }
      const activeTag = (document.activeElement as HTMLElement | null)?.tagName
      if (sketchModeRef.current === 'none' && selectedRef.current && activeTag !== 'INPUT') {
        const step = e.shiftKey ? 0.5 : 0.1
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          nudgeSelected(0, 0, -step)
        } else if (e.key === 'ArrowDown') {
          e.preventDefault()
          nudgeSelected(0, 0, step)
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault()
          nudgeSelected(-step, 0, 0)
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          nudgeSelected(step, 0, 0)
        } else if (e.key === 'PageUp') {
          e.preventDefault()
          nudgeSelected(0, step, 0)
        } else if (e.key === 'PageDown') {
          e.preventDefault()
          nudgeSelected(0, -step, 0)
        }
      }
    }

    renderer.domElement.addEventListener('click', onClick)
    renderer.domElement.addEventListener('dblclick', onDoubleClick)
    renderer.domElement.addEventListener('mousemove', onMouseMove)
    renderer.domElement.addEventListener('pointerdown', onPointerDown, true)
    renderer.domElement.addEventListener('pointermove', onPointerMoveDrag)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointerup', onPointerUp)
      renderer.domElement.removeEventListener('click', onClick)
      renderer.domElement.removeEventListener('dblclick', onDoubleClick)
      renderer.domElement.removeEventListener('mousemove', onMouseMove)
      renderer.domElement.removeEventListener('pointerdown', onPointerDown, true)
      renderer.domElement.removeEventListener('pointermove', onPointerMoveDrag)
      cancelAnimationFrame(raf)
      viewport.removeChild(renderer.domElement)
      renderer.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function addShapeInternal(
    type: ShapeType,
    opts: Partial<{ x: number; y: number; z: number; sx: number; sy: number; sz: number; ry: number; color: string }> = {}
  ) {
    const r = refs.current
    if (!r) return
    const obj = createObject(type, opts.color)
    const baseY = SPECIAL_BASE_Y[type] ?? (GROUND_BASE_TYPES.includes(type) ? 0.5 : type === 'plane' ? 0.05 : 0)
    obj.position.set(opts.x || 0, opts.y !== undefined ? opts.y : baseY, opts.z || 0)
    obj.scale.set(opts.sx || 1, opts.sy || 1, opts.sz || 1)
    obj.rotation.y = ((opts.ry || 0) * Math.PI) / 180
    nameObject(obj, type)
    r.scene.add(obj)
    r.objects.push(obj)
    selectObject(obj)
  }

  function reconstructObject(d: SavedObjectData): THREE.Object3D {
    let obj: THREE.Object3D
    if (d.type === 'extrude' && Array.isArray(d.footprint)) {
      const geo = createExtrudeGeometry(d.footprint, d.footprintHeight || 3)
      obj = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: d.color || '#e0e0e0', roughness: 0.6 }))
      shadowify(obj)
      obj.userData = { shapeType: 'extrude', footprint: d.footprint, footprintHeight: d.footprintHeight }
    } else {
      obj = createObject(d.type, d.color)
    }
    obj.position.set(d.x || 0, d.y || 0, d.z || 0)
    obj.scale.set(d.sx || 1, d.sy || 1, d.sz || 1)
    obj.rotation.y = ((d.ry || 0) * Math.PI) / 180
    nameObject(obj, d.type)
    return obj
  }

  function selectObject(obj: THREE.Object3D | null) {
    const r = refs.current
    if (!r) return
    if (r.outline) {
      r.scene.remove(r.outline)
      r.outline = null
    }
    if (obj) {
      const helper = new THREE.BoxHelper(obj, 0xffffff)
      r.scene.add(helper)
      r.outline = helper
    }
    selectedRef.current = obj
    setSelected(obj)
  }

  function updateOutline() {
    refs.current?.outline?.update()
  }

  function handleAdd(type: ShapeType) {
    pushHistory()
    addShapeInternal(type, { x: (Math.random() - 0.5) * 3, z: (Math.random() - 0.5) * 3 })
  }

  function handleDelete() {
    const r = refs.current
    if (!r || !selected) return
    pushHistory()
    r.scene.remove(selected)
    r.objects = r.objects.filter((o) => o !== selected)
    selectObject(null)
  }

  function handleClearAll() {
    const r = refs.current
    if (!r) return
    if (r.objects.length && !confirm('Clear entire scene?')) return
    pushHistory()
    r.objects.forEach((o) => r.scene.remove(o))
    r.objects = []
    typeCounters.current = {}
    selectObject(null)
  }

  function handleClearMeasurements() {
    refs.current?.measurementGroup.clear()
  }

  function handleView(preset: 'top' | 'front' | 'side' | 'iso') {
    const r = refs.current
    if (!r) return
    if (preset === 'top') {
      r.camera.position.set(0, 25, 0.01)
      r.controls.target.set(0, 0, 0)
    } else if (preset === 'front') {
      r.camera.position.set(0, 3, 18)
      r.controls.target.set(0, 1, 0)
    } else if (preset === 'side') {
      r.camera.position.set(18, 3, 0)
      r.controls.target.set(0, 1, 0)
    } else {
      r.camera.position.set(8, 7, 8)
      r.controls.target.set(0, 1, 0)
    }
    r.controls.update()
  }

  function setPosition(axis: 'x' | 'y' | 'z', v: number) {
    if (!selected || Number.isNaN(v)) return
    selected.position[axis] = v
    updateOutline()
    forceRerender((n) => n + 1)
  }
  function setScale(axis: 'x' | 'y' | 'z', v: number) {
    if (!selected || Number.isNaN(v) || v <= 0) return
    selected.scale[axis] = v
    updateOutline()
    forceRerender((n) => n + 1)
  }
  function setRotationY(deg: number) {
    if (!selected || Number.isNaN(deg)) return
    selected.rotation.y = (deg * Math.PI) / 180
    updateOutline()
    forceRerender((n) => n + 1)
  }
  function setColor(hex: string) {
    if (!selected) return
    collectMaterials(selected).forEach((m) => m.color.set(hex))
    forceRerender((n) => n + 1)
  }
  function applyMaterialPreset(key: MaterialPresetKey) {
    if (!selected) return
    const preset = MATERIAL_PRESETS[key]
    collectMaterials(selected).forEach((m) => {
      m.color.set(preset.color)
      m.roughness = preset.roughness
      m.metalness = preset.metalness
      m.transparent = !!preset.transparent
      m.opacity = preset.opacity ?? 1
      m.needsUpdate = true
    })
    forceRerender((n) => n + 1)
  }

  function flashStatus(msg: string) {
    setStatus(msg)
    setTimeout(() => setStatus('Click an object to select it. Drag it to move, or use arrow keys.'), 1400)
  }

  async function handleSave() {
    const r = refs.current
    if (!r) return
    const data = snapshotScene()
    try {
      localStorage.setItem('studio3d_scene', JSON.stringify(data))
      flashStatus('Saved ✓')
    } catch {
      alert('Save failed')
    }
  }

  async function handleLoad() {
    const r = refs.current
    if (!r) return
    try {
      const raw = localStorage.getItem('studio3d_scene')
      if (!raw) {
        alert('No saved scene found.')
        return
      }
      pushHistory()
      r.objects.forEach((o) => r.scene.remove(o))
      r.objects = []
      typeCounters.current = {}
      selectObject(null)
      const data = JSON.parse(raw) as SavedObjectData[]
      data.forEach((d) => {
        const obj = reconstructObject(d)
        r.scene.add(obj)
        r.objects.push(obj)
      })
      flashStatus('Loaded ✓')
    } catch {
      alert('Nothing saved yet.')
    }
  }

  function handleExportPng() {
    const r = refs.current
    if (!r) return
    r.renderer.render(r.scene, r.camera)
    const link = document.createElement('a')
    link.download = 'studio3d-render.png'
    link.href = r.renderer.domElement.toDataURL('image/png')
    link.click()
  }

  function handleExportObj() {
    const r = refs.current
    if (!r) return
    const exporter = new OBJExporter()
    const group = new THREE.Group()
    r.objects.forEach((o) => group.add(o.clone(true)))
    const result = exporter.parse(group)
    const blob = new Blob([result], { type: 'text/plain' })
    const link = document.createElement('a')
    link.download = 'studio3d-model.obj'
    link.href = URL.createObjectURL(blob)
    link.click()
  }

  const materials = selected ? collectMaterials(selected) : []
  const currentColorHex = materials[0] ? '#' + materials[0].color.getHexString() : '#4f9dff'

  const shapeBtns: { type: ShapeType; label: string }[] = [
    { type: 'box', label: '◻ Box' },
    { type: 'cylinder', label: '◯ Cylinder' },
    { type: 'cone', label: '△ Cone' },
    { type: 'sphere', label: '● Sphere' },
    { type: 'plane', label: '▭ Plane / Slab' },
  ]
  const contextBtns: { type: ShapeType; label: string }[] = [
    { type: 'tree', label: '🌳 Tree' },
    { type: 'car', label: '🚗 Sedan' },
    { type: 'car_suv', label: '🚙 SUV' },
    { type: 'person', label: '🧍 Person' },
  ]
  const buildingBtns: { type: ShapeType; label: string }[] = [
    { type: 'window', label: '🪟 Window' },
    { type: 'door', label: '🚪 Door' },
    { type: 'staircase', label: '🪜 Staircase' },
    { type: 'light', label: '💡 Light' },
    { type: 'pipe', label: '🔧 Pipe Segment' },
  ]
  const furnitureBtns: { type: ShapeType; label: string }[] = [
    { type: 'sofa', label: '🛋 Sofa' },
    { type: 'bed', label: '🛏 Bed' },
    { type: 'chair', label: '💺 Chair' },
    { type: 'dining_table', label: '🍽 Dining Table' },
    { type: 'kitchen_counter', label: '🍳 Kitchen Counter' },
    { type: 'fridge', label: '🧊 Fridge' },
    { type: 'washing_machine', label: '🌀 Washing Machine' },
    { type: 'sink', label: '🚰 Sink' },
    { type: 'toilet', label: '🚽 Toilet' },
    { type: 'bathtub', label: '🛁 Bathtub' },
  ]
  const viewBtns: { key: 'top' | 'front' | 'side' | 'iso'; label: string }[] = [
    { key: 'top', label: '⬆ Top' },
    { key: 'front', label: '➡ Front' },
    { key: 'side', label: '↪ Side' },
    { key: 'iso', label: '🎯 Isometric' },
  ]
  const materialBtns: { key: MaterialPresetKey; label: string }[] = [
    { key: 'concrete', label: 'Concrete' },
    { key: 'glass', label: 'Glass' },
    { key: 'brick', label: 'Brick' },
    { key: 'wood', label: 'Wood' },
    { key: 'steel', label: 'Steel' },
    { key: 'grass', label: 'Grass' },
  ]

  return (
    <div className="dark relative flex h-screen w-full flex-col bg-background text-foreground overflow-hidden">
      {/* Top bar */}
      <div className="flex h-13 flex-shrink-0 flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-1.5">
        <span className="mr-2 text-sm font-semibold">🧊 Studio3D</span>
        <Button size="sm" variant="secondary" onClick={handleDelete} disabled={!selected}>
          🗑 Delete
        </Button>
        <Button size="sm" variant="secondary" onClick={handleUndo} disabled={undoStack.current.length === 0}>
          ↶ Undo
        </Button>
        <Button size="sm" variant="secondary" onClick={handleRedo} disabled={redoStack.current.length === 0}>
          ↷ Redo
        </Button>
        <div className="flex-1" />
        <span className="hidden text-xs text-muted-foreground md:inline">{status}</span>
        <a href={FEEDBACK_HREF}>
          <Button size="sm" variant="secondary">
            💬 Feedback
          </Button>
        </a>
        <Button size="sm" variant="secondary" onClick={handleSave}>
          💾 Save
        </Button>
        <Button size="sm" variant="secondary" onClick={handleLoad}>
          📂 Load
        </Button>
        <Button size="sm" variant="secondary" onClick={handleExportObj}>
          ⬇ Export OBJ
        </Button>
        <Button size="sm" onClick={handleExportPng}>
          📷 Export PNG
        </Button>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <div className="flex w-48 flex-shrink-0 flex-col gap-2 overflow-y-auto border-r border-border bg-card p-3">
          <h4 className="mt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Add 3D Shape</h4>
          {shapeBtns.map(({ type, label }) => (
            <button
              key={type}
              onClick={() => handleAdd(type)}
              className="rounded-md border border-border bg-secondary px-2 py-2 text-left text-xs hover:border-primary"
            >
              {label}
            </button>
          ))}

          <h4 className="mt-3 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Draw &amp; Measure
          </h4>
          <button
            onClick={() => setSketchMode(sketchMode === 'measure' ? 'none' : 'measure')}
            className={`rounded-md border px-2 py-2 text-left text-xs font-medium ${
              sketchMode === 'measure' ? 'border-primary bg-primary text-primary-foreground' : 'border-primary/50 bg-secondary hover:border-primary'
            }`}
          >
            📏 Measure (X/Y/Z)
          </button>
          <button
            onClick={() => setSketchMode(sketchMode === 'polygon' ? 'none' : 'polygon')}
            className={`rounded-md border px-2 py-2 text-left text-xs ${
              sketchMode === 'polygon' ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-secondary hover:border-primary'
            }`}
          >
            ⬠ Footprint (polygon)
          </button>
          {sketchMode === 'polygon' && polygonPointCount >= 3 && (
            <button
              onClick={() => finishPolygonRef.current?.()}
              className="rounded-md border border-primary bg-primary px-2 py-2 text-left text-xs font-medium text-primary-foreground"
            >
              ✓ Finish Shape ({polygonPointCount} pts) · Enter
            </button>
          )}
          <button
            onClick={() => setSketchMode(sketchMode === 'circle' ? 'none' : 'circle')}
            className={`rounded-md border px-2 py-2 text-left text-xs ${
              sketchMode === 'circle' ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-secondary hover:border-primary'
            }`}
          >
            ◯ Circle footprint
          </button>
          <button
            onClick={() => setSketchMode(sketchMode === 'wall' ? 'none' : 'wall')}
            className={`rounded-md border px-2 py-2 text-left text-xs ${
              sketchMode === 'wall' ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-secondary hover:border-primary'
            }`}
          >
            🧱 Wall (click 2 points, any direction)
          </button>
          {sketchMode !== 'none' && (
            <button
              onClick={() => setSketchMode('none')}
              className="rounded-md border border-destructive/50 bg-secondary px-2 py-2 text-left text-xs text-destructive hover:bg-destructive/10"
            >
              ✕ Cancel sketch (Esc)
            </button>
          )}

          <h4 className="mt-3 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Site Context</h4>
          {contextBtns.map(({ type, label }) => (
            <button
              key={type}
              onClick={() => handleAdd(type)}
              className="rounded-md border border-border bg-secondary px-2 py-2 text-left text-xs hover:border-primary"
            >
              {label}
            </button>
          ))}

          <h4 className="mt-3 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Building Elements</h4>
          {buildingBtns.map(({ type, label }) => (
            <button
              key={type}
              onClick={() => handleAdd(type)}
              className="rounded-md border border-border bg-secondary px-2 py-2 text-left text-xs hover:border-primary"
            >
              {label}
            </button>
          ))}

          <h4 className="mt-3 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Interior Furniture
          </h4>
          {furnitureBtns.map(({ type, label }) => (
            <button
              key={type}
              onClick={() => handleAdd(type)}
              className="rounded-md border border-border bg-secondary px-2 py-2 text-left text-xs hover:border-primary"
            >
              {label}
            </button>
          ))}

          <h4 className="mt-3 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Camera Views</h4>
          {viewBtns.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => handleView(key)}
              className="rounded-md border border-border bg-secondary px-2 py-2 text-left text-xs hover:border-primary"
            >
              {label}
            </button>
          ))}

          <h4 className="mt-3 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Scene</h4>
          <button
            onClick={handleClearAll}
            className="rounded-md border border-border bg-secondary px-2 py-2 text-left text-xs hover:border-destructive"
          >
            ✕ Clear all shapes
          </button>
          <button
            onClick={handleClearMeasurements}
            className="rounded-md border border-border bg-secondary px-2 py-2 text-left text-xs hover:border-destructive"
          >
            📏 Clear measurements
          </button>
        </div>

        {/* Viewport */}
        <div className="relative flex-1">
          <div ref={viewportRef} className="absolute inset-0" />
          <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-black/40 px-2.5 py-1.5 text-[11px] text-muted-foreground">
            {sketchMode === 'none'
              ? 'Left-drag empty space: pan · Right-drag: orbit · Drag an object: move it · Scroll: zoom · Arrows/PageUp,Down: nudge selection'
              : sketchMode === 'polygon'
                ? 'Click points on the ground · Enter or "Finish Shape" to close · Esc to cancel'
                : sketchMode === 'measure'
                  ? 'Click ground or an object surface to place points · Esc to cancel'
                  : 'Click on the ground grid to place points · Esc to cancel'}
          </div>
        </div>

        {/* Properties */}
        <div className="w-60 flex-shrink-0 overflow-y-auto border-l border-border bg-card p-4 text-xs">
          <h4 className="mb-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {selected ? selected.name || 'Object' : 'Properties'}
          </h4>
          {!selected ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Select an object in the scene, or add/sketch one from the left, to edit its position, size, rotation and color.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {(['x', 'y', 'z'] as const).map((axis) => (
                <div key={`pos-${axis}`}>
                  <div className="mb-1 flex items-center justify-between text-muted-foreground">
                    <span>Pos {axis.toUpperCase()}</span>
                    <span className="flex items-center gap-1">
                      <input
                        type="number"
                        step={0.1}
                        value={Number(selected.position[axis].toFixed(2))}
                        onChange={(e) => setPosition(axis, parseFloat(e.target.value))}
                        className="w-14 rounded border border-border bg-transparent px-1 text-right text-foreground outline-none"
                      />
                      <span>m</span>
                    </span>
                  </div>
                  <Slider
                    min={axis === 'y' ? 0 : -50}
                    max={50}
                    step={0.1}
                    value={[selected.position[axis]]}
                    onValueChange={([v]) => setPosition(axis, v)}
                  />
                </div>
              ))}
              {(['x', 'y', 'z'] as const).map((axis) => (
                <div key={`scale-${axis}`}>
                  <div className="mb-1 flex items-center justify-between text-muted-foreground">
                    <span>
                      Size {axis.toUpperCase()}
                      {axis === 'y' ? ' (Height)' : ''}
                    </span>
                    <span className="flex items-center gap-1">
                      <input
                        type="number"
                        step={0.1}
                        min={0.1}
                        value={Number(selected.scale[axis].toFixed(2))}
                        onChange={(e) => setScale(axis, parseFloat(e.target.value))}
                        className="w-14 rounded border border-border bg-transparent px-1 text-right text-foreground outline-none"
                      />
                      <span>m</span>
                    </span>
                  </div>
                  <Slider
                    min={0.1}
                    max={6}
                    step={0.1}
                    value={[selected.scale[axis]]}
                    onValueChange={([v]) => setScale(axis, v)}
                  />
                </div>
              ))}
              <div>
                <div className="mb-1 flex items-center justify-between text-muted-foreground">
                  <span>Rotation Y</span>
                  <span className="flex items-center gap-1">
                    <input
                      type="number"
                      step={1}
                      value={Number(((selected.rotation.y * 180) / Math.PI).toFixed(0))}
                      onChange={(e) => setRotationY(parseFloat(e.target.value))}
                      className="w-14 rounded border border-border bg-transparent px-1 text-right text-foreground outline-none"
                    />
                    <span>°</span>
                  </span>
                </div>
                <Slider
                  min={0}
                  max={360}
                  step={1}
                  value={[(selected.rotation.y * 180) / Math.PI]}
                  onValueChange={([v]) => setRotationY(v)}
                />
              </div>

              <div>
                <h4 className="mb-2 mt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Material</h4>
                <div className="grid grid-cols-2 gap-1.5">
                  {materialBtns.map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => applyMaterialPreset(key)}
                      className="rounded-md border border-border bg-secondary px-2 py-1.5 text-[11px] hover:border-primary"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="mb-2 mt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Custom Color</h4>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {SWATCHES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className="h-5 w-5 rounded border-2"
                      style={{
                        background: c,
                        borderColor: currentColorHex.toLowerCase() === c.toLowerCase() ? '#fff' : 'transparent',
                      }}
                    />
                  ))}
                </div>
                <input
                  type="color"
                  value={currentColorHex}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-7 w-full rounded border border-border bg-transparent"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex h-8 flex-shrink-0 items-center justify-center border-t border-border bg-card text-[11px] text-muted-foreground">
        Studio3D — a free 3D massing tool for architecture &amp; CAD students · built by Shagufa Khan
      </div>

      {/* Onboarding overlay */}
      {showOnboarding && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Step {onboardStep + 1} of {ONBOARD_STEPS.length}
              </span>
              <button onClick={dismissOnboarding} className="text-xs text-muted-foreground underline hover:text-foreground">
                Skip intro
              </button>
            </div>
            <h3 className="mb-1.5 text-base font-semibold">{ONBOARD_STEPS[onboardStep].title}</h3>
            <p className="mb-5 text-sm leading-relaxed text-muted-foreground">{ONBOARD_STEPS[onboardStep].body}</p>
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                {ONBOARD_STEPS.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 w-5 rounded-full ${i === onboardStep ? 'bg-primary' : 'bg-secondary'}`}
                  />
                ))}
              </div>
              {onboardStep < ONBOARD_STEPS.length - 1 ? (
                <Button size="sm" onClick={() => setOnboardStep((s) => s + 1)}>
                  Next
                </Button>
              ) : (
                <Button size="sm" onClick={dismissOnboarding}>
                  Got it, let's build!
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
