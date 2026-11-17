import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { BilingualText } from "./BilingualText";
import { Card, WoodPanel } from "./Card";
import { ChunkyButton } from "./ChunkyButton";
import { Dialog } from "./Dialog";
import { TextField } from "./TextField";
import { Toaster, toast } from "./Toast";

const meta: Meta = { title: "Design system/Surfaces and inputs" };
export default meta;
type Story = StoryObj;

const t = { regional: "खलिहान", english: "Barn" };

export const CreamCard: Story = { render: () => <Card style={{ width: 300 }}><BilingualText text={t} size="lg" /></Card> };
export const Wood: Story = { render: () => <WoodPanel style={{ width: 300 }}><BilingualText text={t} size="lg" /></WoodPanel> };
export const Field: Story = {
  render: () => (
    <div style={{ width: 320 }}>
      <TextField label={{ regional: "फ़ोन नंबर", english: "Phone number" }} hint={{ regional: "हम कोड भेजेंगे।", english: "We will send a code." }} prefix="+91" />
    </div>
  ),
};
export const FieldError: Story = {
  render: () => (
    <div style={{ width: 320 }}>
      <TextField label={{ regional: "कोड", english: "Code" }} error={{ regional: "पूरी तरह सही नहीं।", english: "Not quite." }} defaultValue="111111" />
    </div>
  ),
};
export const ModalDialog: Story = {
  render: function Render() {
    const [open, setOpen] = useState(true);
    return (
      <>
        <ChunkyButton onClick={() => setOpen(true)}>Open</ChunkyButton>
        <Dialog open={open} onOpenChange={setOpen} title={{ regional: "मेनू", english: "Menu" }} actions={<ChunkyButton variant="white" onClick={() => setOpen(false)}>Close</ChunkyButton>} />
      </>
    );
  },
};
export const Notifications: Story = {
  render: () => (
    <>
      <ChunkyButton onClick={() => toast("success", { regional: "कोड भेज दिया!", english: "Code sent!" })}>Toast</ChunkyButton>
      <Toaster />
    </>
  ),
};
