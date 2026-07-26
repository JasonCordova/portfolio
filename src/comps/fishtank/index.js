import Fish from '../fish';
import Statue from '../../assets/statue.webp';
import Coral from '../../assets/coral.webp';
import BubbleSprite from '../../assets/bubble.webp';
import Ham from '../../assets/ham.webp';
import Image from 'next/image';
import './index.css';

import { useRef, useState, useEffect, useCallback } from 'react';

const Bubble = ({ id, top, left, onExit, onClick }) => {

    const [popped, setPopped] = useState(false);
    const bubbleRef = useRef(null);
    const topPositionRef = useRef(top);
    const poppedRef = useRef(false); // guards against double-firing (manual pop + auto-pop racing)
    const autoPopDelayMs = 3000;
    const bubbleSizeStart = 4;
    const bubbleSizeEnd = 8;
    const size = useRef(Math.random() * (bubbleSizeEnd - bubbleSizeStart) + bubbleSizeStart);
    const speed = useRef(0.1 + Math.random() * 0.1);
    const shouldExit = useRef(false);

    const handlePop = () => {
        if (poppedRef.current) return; // already popped, ignore
        poppedRef.current = true;

        setPopped(true);
        onClick(id);
    }

    useEffect(() => {

        let animationFrameId;
        let isMounted = true;

        const animate = () => {

            if (!isMounted || shouldExit.current) return;

            const next = topPositionRef.current - speed.current;
            topPositionRef.current = next;

            if (next < -size.current) {
                shouldExit.current = true;
                onExit(id);
                return;
            }

            if (bubbleRef.current) {
                bubbleRef.current.style.top = `${next}%`;
            }

            animationFrameId = requestAnimationFrame(animate);
        };

        animationFrameId = requestAnimationFrame(animate);

        return () => {
            isMounted = false;
            cancelAnimationFrame(animationFrameId);
        };
    }, [onExit, id]);

    // Auto-pop if the bubble hasn't been manually popped within autoPopDelayMs.
    useEffect(() => {

        const autoPopTimer = setTimeout(() => {
            handlePop();
        }, autoPopDelayMs);

        return () => clearTimeout(autoPopTimer);

    }, [handlePop]);   

    return (

        <div ref={bubbleRef} onMouseEnter={handlePop} onClick={handlePop} className="bubble-holder" style={{ pointerEvents: `${popped ? "none" : "all"}`, transform: `translate(-50%, -50%) scale(${popped ? 0 : 1})`, height: `${size.current}%`, position: 'absolute', top: `${top}%`, left: `${left}%` }}>
            <Image height={400} style={{ height: 'auto' }} alt="Bubble" draggable={false} className="bubble" src={BubbleSprite} />
        </div>

    );

};

const FishTank = ({ fishTankRef }) => {

    const bubbleCounter = useRef(0);
    const cursorRef = useRef(null);
    const [bubbles, setBubbles] = useState([]);
    const [hoveringTank, setHoveringTank] = useState(false);
    const [foodEaten, setFoodEaten] = useState(false);

    // One imperative ref per fish instance instead of DOM listeners per fish.
    const fishControlRefs = useRef([]);
    const fishCount = 4;
    const eatenFishRef = useRef(null);

    // Cached tank bounding rect, recomputed lazily. Avoids a
    // getBoundingClientRect() call from every fish on every move.
    const tankRectRef = useRef(null);
    const eatThresholdPixels = 60;

    // How long (in seconds) after food is eaten before it can respawn.
    const eatenRespawnDelaySeconds = 5;
    const respawnTimeoutRef = useRef(null);
    const biteAudioRef = useRef(null);
    const biteAudioVolume = 0.5;
    const starAudioRef = useRef(null);
    const starAudioVolume = 0.5;

    useEffect(() => {

        const tankEl = fishTankRef.current;
        if (!tankEl) return;

        // Invalidate the cached rect on resize/scroll so positions stay accurate.
        const invalidateRect = () => { tankRectRef.current = null; };
        window.addEventListener("resize", invalidateRect);

        const computeXY = (e) => {

            const tankBounding = fishTankRef.current.getBoundingClientRect();
            tankRectRef.current = tankBounding;

            if (e.type === "touchmove" && e.touches && e.touches.length > 0) {
                const x = ((e.touches[0].clientX - tankBounding.left) / tankBounding.width) * 100;
                const y = ((e.touches[0].clientY - tankBounding.top) / tankBounding.height) * 100;
                return { x, y, tankBounding };
            } else {
                const x = ((e.clientX - tankBounding.left) / tankBounding.width) * 100;
                const y = ((e.clientY - tankBounding.top) / tankBounding.height) * 100;
                return { x, y, tankBounding };
            }

        };

        // Finds the closest fish (by pixel distance from the ham's center)
        // and logs "EATEN!" if it's within EAT_THRESHOLD_PX.
        const checkForEaten = (hamPixelX, hamPixelY) => {

            // Already eaten and waiting to respawn — skip the distance
            // check entirely, no point re-triggering while it's on cooldown.
            if (respawnTimeoutRef.current) return;

            let nearestDistance = Infinity;
            let nearestFish = null;

            fishControlRefs.current.forEach((fish) => {

                const el = fish?.getElement?.();
                if (!el) return;

                const rect = el.getBoundingClientRect();
                const fishCenterX = rect.left + rect.width / 2;
                const fishCenterY = rect.top + rect.height / 2;

                const distance = Math.hypot(fishCenterX - hamPixelX, fishCenterY - hamPixelY);

                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestFish = fish;
                }

            });

            if (nearestFish && nearestDistance <= eatThresholdPixels) {
                
                setFoodEaten(true);

                // Play bite sound effect:
                if (biteAudioRef.current) {
                    biteAudioRef.current.currentTime = 0;
                    biteAudioRef.current.volume = biteAudioVolume;
                    biteAudioRef.current.play();
                }

                nearestFish.setStarred(true);
                nearestFish.setFrenzied(true);
                nearestFish.grow();
                eatenFishRef.current = nearestFish;

                // Start star sound on loop while starred
                if (starAudioRef.current) {
                    starAudioRef.current.currentTime = 0;
                    starAudioRef.current.volume = starAudioVolume;
                    starAudioRef.current.loop = true;
                    starAudioRef.current.play();
                }

                // Release every fish from cursor-tracking immediately so they
                // resume their own wandering instead of staying frozen mid-chase.
                fishControlRefs.current.forEach(fish => fish?.deactivate());

                respawnTimeoutRef.current = setTimeout(() => {

                    setFoodEaten(false);
                    eatenFishRef.current?.setStarred(false);
                    eatenFishRef.current?.setFrenzied(false);
                    eatenFishRef.current = null;
                    respawnTimeoutRef.current = null;

                    // Stop star sound and reset it
                    if (starAudioRef.current) {
                        starAudioRef.current.pause();
                        starAudioRef.current.currentTime = 0;
                        starAudioRef.current.loop = false;
                    }

                }, eatenRespawnDelaySeconds * 1000);

            }

        };

        const handlePointerActive = (e) => {

            const { x, y, tankBounding } = computeXY(e);

            // Skip re-activating fish while food is on cooldown — otherwise the
            // very next mousemove immediately re-engages tracking, undoing the
            // deactivate() call in checkForEaten.
            if (!respawnTimeoutRef.current) {
                fishControlRefs.current.forEach(fish => fish?.activate(x, y));
            }

            // Directly update ham position — no CustomEvent round trip needed
            // now that this all lives in one place.
            if (cursorRef.current) {
                setHoveringTank(true);
                cursorRef.current.style.left = `${x}%`;
                cursorRef.current.style.top = `${y}%`;
            }

            // Convert the ham's percentage position back to viewport pixels
            // so it's in the same coordinate space as getBoundingClientRect().
            const hamPixelX = tankBounding.left + (x / 100) * tankBounding.width;
            const hamPixelY = tankBounding.top + (y / 100) * tankBounding.height;

            checkForEaten(hamPixelX, hamPixelY);

            // Touch doesn't fire mouseenter/mouseover as the finger drags across
            // elements, so bubbles never see their hover-pop trigger on mobile.
            // Manually hit-test what's under the touch point instead.
            if (e.type === "touchmove" && e.touches && e.touches.length > 0) {

                const touch = e.touches[0];
                const target = document.elementFromPoint(touch.clientX, touch.clientY);
                const bubbleEl = target?.closest(".bubble-holder");

                if (bubbleEl) {
                    bubbleEl.click(); // reuses the existing onClick pop logic already wired up
                }

            }

        };

        const handlePointerLeave = () => {
            fishControlRefs.current.forEach(fish => fish?.deactivate());
            setHoveringTank(false);
        };

        tankEl.addEventListener("mousedown", handlePointerActive);
        tankEl.addEventListener("mousemove", handlePointerActive);
        tankEl.addEventListener("mouseleave", handlePointerLeave);
        tankEl.addEventListener("touchend", handlePointerLeave);
        tankEl.addEventListener("touchmove", handlePointerActive);

        return () => {
            window.removeEventListener("resize", invalidateRect);
            tankEl.removeEventListener("mousedown", handlePointerActive);
            tankEl.removeEventListener("mousemove", handlePointerActive);
            tankEl.removeEventListener("mouseleave", handlePointerLeave);
            tankEl.removeEventListener("touchend", handlePointerLeave);
            tankEl.removeEventListener("touchmove", handlePointerActive);
        }

    }, [fishTankRef]);

    const handleBubblePop = useCallback((id) => {

        const bubblePopEvent = new CustomEvent("bubblePop");
        window.dispatchEvent(bubblePopEvent);

        setTimeout(() => {
            handleBubbleExit(id);
        }, 200);

    }, []);

    const handleBubbleExit = useCallback((id) => {
        setBubbles(prev => prev.filter(bubble => bubble.id !== id));
    }, []);

    const createBubble = useCallback((x, y) => {
        setBubbles(prev => [
            ...prev,
            { id: `${bubbleCounter.current++}`, x, y }
        ]);
    }, []);

    const handleClick = (e) => {
        // console.log(e.clientX);
    }

    return (

        <div ref={fishTankRef} className="fishtank" onClick={handleClick}>

            <audio src="/bite.wav" ref={biteAudioRef}></audio>
            <audio src="/star_power.wav" ref={starAudioRef}></audio>

            <div ref={cursorRef} alt="Ham" draggable={false} className={`cursor${(hoveringTank) ? "" : " disabled"}`}>
                <div className={`empty-cursor${!foodEaten ? " disabled" : ""}`}></div>
                <Image alt="Ham" draggable={false} className={`ham${!foodEaten ? "" : " disabled"}`} src={Ham} />
            </div>

            {Array.from({ length: fishCount }).map((_, i) => (
                <Fish
                    key={i}
                    ref={fishTankRef}
                    controlRef={(el) => { fishControlRefs.current[i] = el; }}
                    type={i < 2 ? "tropical" : ""}
                    onBlowBubble={createBubble}
                />
            ))}

            {bubbles.map(bubble => (
                <Bubble
                    key={bubble.id}
                    id={bubble.id}
                    top={bubble.y}
                    left={bubble.x}
                    onClick={handleBubblePop}
                    onExit={handleBubbleExit}
                />
            ))}

            <div className="gradient"></div>
            <Image width={1} style={{ width: "auto" }} alt="Coral Emoji" draggable={false} className='coral-1' src={Coral} />
            <Image width={1} style={{ width: "auto" }} alt="Coral Emoji" draggable={false} className='coral-3' src={Coral} />
            <Image width={1} style={{ width: "auto" }} alt="Coral Emoji" draggable={false} className='coral-2' src={Coral} />
            <Image width={1} style={{ width: "auto" }} className="statue" alt="Sunked Statue of Liberty" draggable={false} src={Statue} />

        </div>

    )

}

export default FishTank;