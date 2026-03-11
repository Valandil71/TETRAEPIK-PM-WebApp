"use client";

import { useState, useEffect, useMemo } from "react";

interface TypewriterTextProps {
  text: string;
  speed?: number;
  delay?: number;
  className?: string;
}

export function TypewriterText({
  text,
  speed = 50,
  delay = 0,
  className = "",
}: TypewriterTextProps) {
  const [displayedText, setDisplayedText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isReady, setIsReady] = useState(false);

  // Split text into proper characters (handles emoji, accents, etc.)
  const characters = useMemo(() => Array.from(text), [text]);

  // Reset when text changes
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDisplayedText("");
      setCurrentIndex(0);
      setIsReady(false);
    }, 0);
    return () => clearTimeout(timeout);
  }, [text, delay]);

  // Handle initial delay
  useEffect(() => {
    const delayTimeout = setTimeout(() => {
      setIsReady(true);
    }, delay);

    return () => clearTimeout(delayTimeout);
  }, [delay]);

  // Typing effect
  useEffect(() => {
    if (!isReady || currentIndex >= characters.length) return;

    const timeout = setTimeout(() => {
      setDisplayedText((prev) => prev + characters[currentIndex]);
      setCurrentIndex((prev) => prev + 1);
    }, speed);

    return () => clearTimeout(timeout);
  }, [currentIndex, characters, speed, isReady]);

  return <span className={className}>{displayedText}</span>;
}
