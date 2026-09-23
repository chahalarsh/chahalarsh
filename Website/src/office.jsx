import React, { useEffect, useRef } from 'react'
import * as THREE from "three"
import { Canvas, useGraph, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF, useTexture, useAnimations } from '@react-three/drei'
import { normalMap, sample, texture } from 'three/tsl'
import gsap from "gsap";
import { useGSAP } from '@gsap/react'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useFrame } from '@react-three/fiber'

gsap.registerPlugin(ScrollTrigger)

const office = () => {

    const { camera, scene, gl } = useThree()

    camera.position.x = 0;
    camera.position.y = 0;
    camera.position.z = 2.5;
    camera.fov = 40
    camera.updateProjectionMatrix()


    const model = useGLTF("/model/mac.glb")

    const { actions } = useAnimations(model.animations, model.scene)

    const clipDuration = useRef(0);
    const scrollProgress = useRef(0);

    useEffect(() => {
        const action = actions["EmptyAction.001"]
        action.play();
        action.paused = true;

        clipDuration.current = action.getClip().duration
        ScrollTrigger.refresh();
    }, [actions])

    useGSAP(() => {

        const tl = gsap.timeline({
            defaults: { ease: "none" },
            scrollTrigger: {
                trigger: "#office",      // or a specific section ref
                endTrigger: "#office3",
                start: "top top",
                end: "middle middle",
                scrub: 0.3,                    // smooths it, ties directly to scrollbar
            },
        })


        tl.to(model.scene.position, {
            y: "-0.4",
            z: "+0.5",
            duration: 1
        }, 0)

        tl.to(scrollProgress, { 
            current: 1,
            duration: 1
        }, 0)

        tl.to(model.scene.position, {
            y: "-0.8",
            z: "+3",
            duration: 1
        },1)

        tl.to(":root",{
            "--body-color": "#111110",
            duration: 1
        },1)
        
    }, [])

    useFrame(() => {
        if (actions["EmptyAction.001"]) {
            actions["EmptyAction.001"].time = scrollProgress.current * clipDuration.current;
        }
    })


    return (
        <>
            <primitive object={model.scene} position={[0, 0, 0]} scale={[1, 1, 1]} />
            <directionalLight intensity={5} color={0xffffff} position={[0, 3, 3]} />
            {/* <OrbitControls/>  */}
        </>
    )
}

export default office