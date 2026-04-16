// Email Header Component - Shows from, to, cc, bcc, subject fields

import React from "react";
import { Box, Text } from "ink";

interface Props {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  width: number;
}

export function EmailHeader({ from, to, cc, bcc, subject, width }: Props) {
  const labelWidth = 8; // Width for labels like "From:", "To:", etc.

  const renderField = (label: string, value: string | string[], color: string = "white") => {
    const displayValue = Array.isArray(value) ? value.join(", ") : value;
    if (!displayValue) return null;

    return (
      <Box>
        <Box width={labelWidth}>
          <Text color="gray">{label}</Text>
        </Box>
        <Box flexShrink={1}>
          <Text color={color as any} wrap="truncate-end">
            {displayValue}
          </Text>
        </Box>
      </Box>
    );
  };

  return (
    <Box flexDirection="column" marginBottom={1}>
      {renderField("From:", from, "cyan")}
      {renderField("To:", to, "white")}
      {cc && cc.length > 0 && renderField("Cc:", cc, "gray")}
      {bcc && bcc.length > 0 && renderField("Bcc:", bcc, "gray")}
      <Box marginTop={1}>
        <Box width={labelWidth}>
          <Text color="gray">Subject:</Text>
        </Box>
        <Box flexShrink={1}>
          <Text bold wrap="truncate-end">
            {subject}
          </Text>
        </Box>
      </Box>
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          {"─".repeat(Math.max(0, width - 4))}
        </Text>
      </Box>
    </Box>
  );
}
