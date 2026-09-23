
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './office.jsx'
import { Canvas, useThree } from '@react-three/fiber'

createRoot(document.getElementById('office')).render(
  <StrictMode>
    <>
      <Canvas>
        <App />
      </Canvas>
    </>
  </StrictMode>,
)
