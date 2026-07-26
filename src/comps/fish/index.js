import FishSprite from '../../assets/fish.webp';
import TropicalFishSprite from '../../assets/tropical_fish.webp';
import './index.css';
import { useEffect, useState, useRef, forwardRef, useImperativeHandle } from 'react';
import Image from 'next/image';

import FishCap from '../../assets/hats/fish_cap.webp';
import FishHelmet from '../../assets/hats/fish_helmet.webp';
import FishSunglasses from '../../assets/hats/fish_sunglasses.webp';
import FishTophat from '../../assets/hats/fish_tophat.webp';

import TropicalFishCap from '../../assets/hats/tropical_fish_cap.webp';
import TropicalFishHelmet from '../../assets/hats/tropical_fish_helmet.webp';
import TropicalFishSunglasses from '../../assets/hats/tropical_fish_sunglasses.webp';
import TropicalFishTophat from '../../assets/hats/tropical_fish_tophat.webp';

const regFishHats = [FishCap, FishHelmet, FishSunglasses, FishTophat];
const tropicalFishHats = [TropicalFishCap, TropicalFishHelmet, TropicalFishSunglasses, TropicalFishTophat];

const minSize = 10;
const maxSize = 20;
const maxDegree = 40;
const growthIncrement = 2.5;

const maxTransitionSpeed = 8; // Goes off seconds
const minTransitionSpeed = 3; // Goes off seconds

const minDelay = 30; // Goes off 100 ms
const maxDelay = 80; // Goes off 100 ms

// Frenzy speeds — much faster/shorter than normal wandering.
const frenzyMinTransitionSpeed = 0.7; // seconds
const frenzyMaxTransitionSpeed = 0.7; // seconds
const frenzyMinDelay = 7; // Goes off 100 ms - for rotation
const frenzyMaxDelay = 7; // Goes off 100 ms - for rotation

const minBubbleDelay = 30; // Goes off 100 ms
const maxBubbleDelay = 150; // Goes off 100 ms

const Fish = forwardRef((props, tankRef) => {

    // tankRef refers to the passed in fishTankRef from FishTank component
    const FishRotator = useRef(null);
    const FishElement = useRef(null);
    const IntervalRef = useRef(null);
    const BubbleIntervalRef = useRef(null);
    const FocusState = useRef(false);
    const FrenzyState = useRef(false);
    const FishMouth = useRef(null);
    const CurrentSizeRef = useRef(null);

    const [starred, setStarred] = useState(false);
    const [hasHat, setHasHat] = useState(false);
    const [hatIndex, setHatIndex] = useState(null);

    const position = useRef({

        prevX: null,
        prevY: null,
        facingRight: true

    });

    const setFrenzied = (value) => {
        FrenzyState.current = value;
    };

    // const getRandomSize = () => Math.round(Math.random() * (maxSize - minSize) + minSize);
    const getRandomSize = () => {
        const steps = Math.floor((maxSize - minSize) / growthIncrement);
        const randomStep = Math.floor(Math.random() * (steps + 1));
        return minSize + randomStep * growthIncrement;
    };

    const grow = () => {

        let nextSize = (CurrentSizeRef.current ?? minSize) + growthIncrement;

        if (nextSize > maxSize) {

            nextSize = minSize;
            
            // Apply random hat to fish:
            const nextHatIndex = hatIndex === null
                ? Math.floor(Math.random() * regFishHats.length)
                : (hatIndex + 1) % regFishHats.length;

            setHatIndex(nextHatIndex);
            setHasHat(true);

        }

        CurrentSizeRef.current = nextSize;
        FishElement.current.style.height = `${nextSize}%`;

    }

    const stopMoving = () => {

        if (IntervalRef.current){
            clearInterval(IntervalRef.current);
            IntervalRef.current = null;
        }

        var fishBounding = FishElement.current.getBoundingClientRect();
        var tankBounding = tankRef.current.getBoundingClientRect();

        var currentX = (((fishBounding.left + fishBounding.width/2) - tankBounding.left) / tankBounding.width) * 100;
        var currentY = (((fishBounding.top + fishBounding.height/2) - tankBounding.top) / tankBounding.height) * 100;

        position.current.prevX = currentX;
        position.current.prevY = currentY;

        FishElement.current.style.top = `${currentY}%`;
        FishElement.current.style.left = `${currentX}%`;

    }

    const lookAt = (x, y) => {

        position.current.facingRight = x > position.current.prevX;

        const xDifference = x - position.current.prevX;
        const yDifference = position.current.prevY - y;
        var angle = (Math.floor(Math.atan2(yDifference, xDifference) * 180 / Math.PI) * -1);

        if (angle > 90) angle -= 180;
        else if (angle < -90) angle += 180;

        angle = Math.min(Math.max(angle, -maxDegree), maxDegree);
        if (!position.current.facingRight) angle *= -1;

        FishRotator.current.style.transform = `
            rotateY(${position.current.facingRight ? 0 : 180}deg)
            rotateZ(${angle}deg)
        `;

    }

    // Called by FishTank's single pointer handler on every move while the
    // pointer is "active" over the tank. Only stops wandering once, on the
    // transition into focus, rather than re-pinning position on every move.
    const activate = (x, y) => {

        if (!FocusState.current) {
            FocusState.current = true;
            stopMoving();
        }

        lookAt(x, y);

    }

    // Called by FishTank's single pointer handler on mouseleave/touchend.
    const deactivate = () => {

        FocusState.current = false;
        if (!IntervalRef.current) { // Only restart if no interval exists
            updatePosition();
        }

    }

    useImperativeHandle(tankRef ? undefined : undefined, () => ({}), []); // placeholder removed below

    const handleFishClick = () => {
        blowBubbles();
    }

    const blowBubbles = () => {

        // Play audio for bubble swish:
        const bubbleSwishEvent = new CustomEvent("bubbleSwish");
        window.dispatchEvent(bubbleSwishEvent);

        var newRandomBubbleDelay = Math.round(Math.random() * (maxBubbleDelay - minBubbleDelay) + minBubbleDelay) * 100;
        var fishMouthRect = FishMouth.current.getBoundingClientRect();
        var fishTank = tankRef.current;
        var fishTankRect = fishTank.getBoundingClientRect();

        const positionX = ((fishMouthRect.left - fishTankRect.left) / fishTankRect.width) * 100;
        const positionY = ((fishMouthRect.top - fishTankRect.top) / fishTankRect.height) * 100;

        if (!document.hidden){
            props.onBlowBubble(positionX, positionY);
            props.onBlowBubble(positionX + (Math.random() * position.current.facingRight ? 1 : -1 *  1 + 0), positionY + 2);
            props.onBlowBubble(positionX + (Math.random() * position.current.facingRight ? 1 : -1 *  1 + 0), positionY + 4);
        }

        if (BubbleIntervalRef.current) clearInterval(BubbleIntervalRef.current);
        BubbleIntervalRef.current = setInterval(blowBubbles, newRandomBubbleDelay);

    }

    const updatePosition = () => {

        if (IntervalRef.current) {
            clearInterval(IntervalRef.current);
            IntervalRef.current = null;
        }

        const isFrenzied = FrenzyState.current;

        const currentMinDelay = isFrenzied ? frenzyMinDelay : minDelay;
        const currentMaxDelay = isFrenzied ? frenzyMaxDelay : maxDelay;
        const currentMinTransition = isFrenzied ? frenzyMinTransitionSpeed : minTransitionSpeed;
        const currentMaxTransition = isFrenzied ? frenzyMaxTransitionSpeed : maxTransitionSpeed;

        var randomDelay = Math.round(Math.random() * (currentMaxDelay - currentMinDelay) + currentMinDelay) * 100;
        var randomTransition = Math.random() * (currentMaxTransition - currentMinTransition) + currentMinTransition;
        var randomX = Math.round(Math.random() * 76 + 12);
        var randomY = Math.round(Math.random() * 74 + 13);

        if (position.current.prevX !== null) {

            position.current.facingRight = randomX > position.current.prevX;

            const xDifference = randomX - position.current.prevX;
            const yDifference = position.current.prevY - randomY;
            var angle = (Math.floor(Math.atan2(yDifference, xDifference) * 180 / Math.PI) * -1);

            if (angle > 90) angle -= 180;
            else if (angle < -90) angle += 180;

            angle = Math.min(Math.max(angle, -maxDegree), maxDegree);
            if (!position.current.facingRight) angle *= -1;

            FishRotator.current.style.transform = `
                rotateY(${position.current.facingRight ? 0 : 180}deg)
                rotateZ(${angle}deg)
            `;

        }

        FishElement.current.style.transition = `left ${randomTransition}s ease-in-out, top ${randomTransition}s ease-in-out, height 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)`;
        FishElement.current.style.left = `${randomX}%`;
        FishElement.current.style.top = `${randomY}%`;

        position.current.prevX = randomX;
        position.current.prevY = randomY;

        if (!FocusState.current) {
            IntervalRef.current = setInterval(updatePosition, randomDelay);
        }

    }

    // Expose an imperative API to FishTank instead of each Fish attaching
    // its own mousemove/mousedown/mouseleave/touchmove/touchend listeners.
    useImperativeHandle(props.controlRef, () => ({
        activate,
        deactivate,
        getElement: () => FishElement.current,
        setStarred,
        setFrenzied,
        grow
    }));

    useEffect(() => {

        let randomSize = getRandomSize();
        CurrentSizeRef.current = randomSize;
        FishElement.current.style.height = `${randomSize}%`;

        const startX = Math.random() * 76 + 12;
        const startY = Math.random() * 74 + 13;
        FishElement.current.style.left = `${startX}%`;
        FishElement.current.style.top = `${startY}%`;

        updatePosition();
        const initialTimer = setTimeout(() => {updatePosition();}, 10);
        BubbleIntervalRef.current = setInterval(blowBubbles, Math.round(Math.random() * (maxBubbleDelay - minBubbleDelay) + minBubbleDelay) * 100);

        return () => {
            clearTimeout(initialTimer);
            if (IntervalRef.current) clearInterval(IntervalRef.current);
            if (BubbleIntervalRef.current) clearInterval(BubbleIntervalRef.current);
        }

    }, []);

    return (

        <div className="fish" ref={FishElement} onClick={handleFishClick}>
            <div className={`fish-rotator${starred ? " starred" : ""}`} ref={FishRotator}>

                <div ref={FishMouth} className="fish-mouth"></div>

                <div className="fish-body-wrapper">

                    {hasHat && hatIndex !== null && (
                        <Image width={1} style={{ width: 'auto' }} alt="Fish Hat" draggable={false} className="fish-hat" src={props.type === "tropical" ? tropicalFishHats[hatIndex] : regFishHats[hatIndex]} />
                    )}

                    <Image width={1} style={{ width: 'auto' }} alt="Fish" draggable={false} className="fish-img" src={props.type === "tropical" ? TropicalFishSprite : FishSprite} />

                    <div
                        className={`fish-star-overlay${starred ? " active" : ""}`}
                        style={{ '--star-mask-src': `url(${(props.type === "tropical" ? TropicalFishSprite : FishSprite).src})` }}
                    />

                </div>

            </div>
        </div>

    )

});

Fish.displayName = "Fish";
export default Fish;