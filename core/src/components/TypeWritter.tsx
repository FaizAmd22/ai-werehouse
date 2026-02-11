/* eslint-disable react-hooks/set-state-in-effect */
import React, { useEffect, useState } from "react";
import { cx } from "../utils";

interface TypeWritterProps {
  text: string;
  speed?: number;
  textSize?: string;
  isBold?: boolean;
  onDone?: () => void;
}

const TypeWritter: React.FC<TypeWritterProps> = ({
  text,
  speed = 50,
  textSize = "text-xl",
  isBold = false,
  onDone,
}) => {
  const [displayedText, setDisplayedText] = useState("");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setDisplayedText("");
    setIndex(0);
  }, [text]);

  useEffect(() => {
    if (index >= text.length) {
      onDone?.();
      return;
    }

    const timeout = setTimeout(() => {
      setDisplayedText((prev) => prev + text[index]);
      setIndex((prev) => prev + 1);
    }, speed);

    return () => clearTimeout(timeout);
  }, [index, text, speed, onDone]);

  return (
    <div className="max-w-3xl h-44 text-center">
      <p
        className={cx(
          "text-white text-shadow-lg/30",
          textSize,
          isBold ? "font-bold" : "font-normal"
        )}
      >
        {displayedText}
      </p>
    </div>
  );
};

export default TypeWritter;
