// Route Display Component - ASCII art route visualization

import React from "react";
import { Box, Text } from "ink";
import { type Airport, CYBER_COLORS } from "../types";

interface Props {
  origin: Airport;
  destination: Airport;
  width: number;
}

export function RouteDisplay({ origin, destination, width }: Props) {
  // Calculate the route line width
  const codeWidth = 3; // Airport codes are 3 chars
  const airplaneWidth = 8; // <=====|>
  const padding = 4;
  const routeLineWidth = Math.max(10, width - (codeWidth * 2) - airplaneWidth - padding);

  // Build the route line with airplane
  const airplane = "<=====|>";
  const halfRoute = Math.floor((routeLineWidth - airplane.length) / 2);
  const routeLine = "~".repeat(halfRoute) + airplane + "~".repeat(halfRoute);

  return (
    <Box flexDirection="column">
      {/* Route line with codes */}
      <Box justifyContent="center">
        <Text color={CYBER_COLORS.neonCyan} bold>
          {origin.code}
        </Text>
        <Text color={CYBER_COLORS.neonMagenta}> {routeLine} </Text>
        <Text color={CYBER_COLORS.neonCyan} bold>
          {destination.code}
        </Text>
      </Box>

      {/* City names */}
      <Box justifyContent="space-between" width={width - 2}>
        <Text color={CYBER_COLORS.dim}>{origin.city}</Text>
        <Text color={CYBER_COLORS.dim}>{destination.city}</Text>
      </Box>
    </Box>
  );
}
