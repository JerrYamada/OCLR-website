"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useAppTranslations } from "@/i18n/shared";
import { WorkspaceTabs } from "./workspace-tabs";

export function MappoolRounds({
  rounds,
}: {
  rounds: { value: string; label: string; content: ReactNode }[];
}) {
  const tr = useAppTranslations();
  const id = useId();
  const [selected, setSelected] = useState(rounds[0].value);
  const navigation = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const active = rounds.find((round) => round.value === selected) ?? rounds[0];

  useEffect(() => {
    const header = document.querySelector(".site-header");
    if (!header) return;
    const measure = () => {
      navigation.current?.parentElement?.style.setProperty(
        "--mappool-header-height",
        `${header.getBoundingClientRect().height}px`,
      );
      navigation.current?.parentElement?.style.setProperty(
        "--mappool-navigation-height",
        `${navigation.current.getBoundingClientRect().height}px`,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    if (navigation.current) observer.observe(navigation.current);
    return () => observer.disconnect();
  }, [rounds.length]);

  if (rounds.length === 1) return rounds[0].content;

  return (
    <div className="mappool-round-browser">
      <div className="mappool-round-navigation" ref={navigation}>
        <span className="small">{tr("Mappool rounds")}</span>
        <WorkspaceTabs
          id={id}
          label={tr("Mappool rounds")}
          items={rounds}
          value={active.value}
          onChange={(value) => {
            setSelected(value);
            if (!panel.current || !navigation.current) return;
            const header = document.querySelector(".site-header");
            window.scrollTo({
              top:
                window.scrollY +
                panel.current.getBoundingClientRect().top -
                (header?.getBoundingClientRect().height ?? 0) -
                navigation.current.getBoundingClientRect().height -
                12,
              behavior: "instant",
            });
          }}
          literalLabels
        />
      </div>
      <div
        ref={panel}
        key={active.value}
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-${active.value}`}
        tabIndex={0}
      >
        {active.content}
      </div>
    </div>
  );
}
