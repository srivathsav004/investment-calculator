"use client";

import { useState, type ReactNode } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface ResultsTab {
  value: string;
  label: string;
  content: ReactNode;
}

interface ResultsLayoutProps {
  /** The inputs column (cards). On large screens it can be hidden so wide tables get the full width. */
  inputs: ReactNode;
  tabs: ResultsTab[];
  value: string;
  onValueChange: (value: string) => void;
}

/** Inputs on the left, results in tabs on the right, with a "Hide inputs" toggle for full-width ledgers. */
export function ResultsLayout({ inputs, tabs, value, onValueChange }: ResultsLayoutProps) {
  const [showInputs, setShowInputs] = useState(true);
  return (
    <div className={cn("grid grid-cols-1 gap-4", showInputs && "lg:grid-cols-[340px_minmax(0,1fr)]")}>
      <div className={cn("space-y-4", !showInputs && "lg:hidden")}>{inputs}</div>
      <div className="min-w-0">
        <Tabs value={value} onValueChange={onValueChange} className="gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TabsList className="h-auto w-full flex-wrap justify-start sm:w-fit">
              {tabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <Button variant="ghost" size="sm" className="hidden text-muted-foreground lg:inline-flex" onClick={() => setShowInputs((v) => !v)}>
              {showInputs ? <PanelLeftClose className="size-3.5" /> : <PanelLeftOpen className="size-3.5" />}
              {showInputs ? "Hide inputs" : "Show inputs"}
            </Button>
          </div>
          {tabs.map((tab) => (
            <TabsContent key={tab.value} value={tab.value} className="space-y-4">
              {tab.content}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
