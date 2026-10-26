import React from 'react';
import {
  Dialog,
  DialogContent,
  Button,
  Typography,
  Box,
  CircularProgress,
} from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import TimerIcon from '@mui/icons-material/Timer';

export interface SessionTimeoutModalProps {
  open: boolean;
  onStaySignedIn: () => void | Promise<void>;
  onSignOut: () => void;
  remainingSeconds: number;
  totalSeconds?: number;
  isLoading?: boolean;
}

export const SessionTimeoutModal: React.FC<SessionTimeoutModalProps> = ({
  open,
  onStaySignedIn,
  onSignOut,
  remainingSeconds,
  totalSeconds = 120,
  isLoading = false,
}) => {
  // Format remaining seconds into MM:SS or HH:MM:SS
  const formatTimeParts = (seconds: number) => {
    const safeSecs = Math.max(0, seconds);
    const hrs = Math.floor(safeSecs / 3600);
    const mins = Math.floor((safeSecs % 3600) / 60);
    const secs = Math.floor(safeSecs % 60);
    const formatted =
      hrs > 0
        ? `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
        : `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    const subLabel = hrs > 0 ? 'HOURS : MIN : SEC' : 'MIN : SEC';
    return { formatted, subLabel };
  };

  const { formatted, subLabel } = formatTimeParts(remainingSeconds);

  // SVG Circular Clock dimensions
  const svgSize = 280;
  const center = svgSize / 2;
  const strokeWidth = 12;
  const radius = center - strokeWidth - 14;
  const circumference = 2 * Math.PI * radius;

  // Calculate ratio (depletes as remainingSeconds drops)
  const ratio = Math.min(1, Math.max(0, remainingSeconds / totalSeconds));
  const strokeDashoffset = circumference * (1 - ratio);

  // Calculate total minutes for dial numbers (e.g. 5 minutes)
  const totalMinutes = Math.max(1, Math.round(totalSeconds / 60));

  // Generate minute numbers around dial starting with 5 (totalMinutes) at top (12 o'clock)
  const minuteNumbers = Array.from({ length: totalMinutes }).map((_, i) => {
    const val = totalMinutes - i; // 5, 4, 3, 2, 1
    const angle = (i / totalMinutes) * 2 * Math.PI - Math.PI / 2;
    const numberRadius = radius - 22;
    const x = center + numberRadius * Math.cos(angle);
    const y = center + numberRadius * Math.sin(angle) + 5;
    return { val, x, y };
  });

  // Generate tick marks (30 ticks for 5 minutes, major tick every minute)
  const totalTicks = totalMinutes * 6;
  const tickMarks = Array.from({ length: totalTicks }).map((_, i) => {
    const angle = (i / totalTicks) * 2 * Math.PI - Math.PI / 2;
    const isMajor = i % 6 === 0;
    const innerRadius = radius - (isMajor ? 12 : 6);
    const outerRadius = radius - 4;
    const x1 = center + innerRadius * Math.cos(angle);
    const y1 = center + innerRadius * Math.sin(angle);
    const x2 = center + outerRadius * Math.cos(angle);
    const y2 = center + outerRadius * Math.sin(angle);
    return { x1, y1, x2, y2, isMajor };
  });

  return (
    <Dialog
      open={open}
      onClose={(_event, reason) => {
        if (reason === 'backdropClick' || reason === 'escapeKeyDown') return;
      }}
      disableEscapeKeyDown
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: { xs: '12px', sm: '16px' },
          overflow: 'hidden',
          boxShadow: '0 25px 70px rgba(10, 28, 54, 0.35)',
          background: '#FFFFFF',
          position: 'relative',
          mx: { xs: 2, sm: 'auto' },
          width: { xs: 'calc(100% - 32px)', sm: '420px' },
        },
      }}
    >
      {/* Main Dialog Content */}
      <DialogContent
        sx={{
          p: { xs: 2.5, sm: 3 },
          pt: { xs: 3.5, sm: 4 },
          pb: { xs: 3, sm: 3.5 },
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        {/* Title & Subtitle */}
        <Typography
          variant="h5"
          sx={{
            fontWeight: 900,
            color: '#0A1C36',
            fontSize: { xs: '1.3rem', sm: '1.5rem' },
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
          }}
        >
          STAY SIGNED IN
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: '#64748B',
            fontSize: { xs: '0.85rem', sm: '0.95rem' },
            mt: 0.5,
            mb: { xs: 2, sm: 2.5 },
          }}
        >
          Your session will expire in
        </Typography>

        {/* Analog / Circular Clock Box */}
        <Box
          sx={{
            position: 'relative',
            width: { xs: 230, sm: svgSize },
            height: { xs: 230, sm: svgSize },
            my: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
          }}
        >
          <svg viewBox={`0 0 ${svgSize} ${svgSize}`} width="100%" height="100%">
            <defs>
              <radialGradient id="dialRadialBg" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#0B2347" />
                <stop offset="80%" stopColor="#061122" />
                <stop offset="100%" stopColor="#030812" />
              </radialGradient>
              <linearGradient id="cyanProgressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00F0FF" />
                <stop offset="60%" stopColor="#0099FF" />
                <stop offset="100%" stopColor="#0055FF" />
              </linearGradient>
            </defs>

            {/* Dial Background Face */}
            <circle cx={center} cy={center} r={radius} fill="url(#dialRadialBg)" />

            {/* Background Track Ring */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="#0F2444"
              strokeWidth={strokeWidth}
            />

            {/* Dynamic Progress Ring Arc */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="url(#cyanProgressGradient)"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform={`rotate(-90 ${center} ${center})`}
              style={{
                transition: 'stroke-dashoffset 0.5s ease-in-out',
              }}
            />

            {/* Dial Tick Marks */}
            {tickMarks.map((tick, index) => (
              <line
                key={index}
                x1={tick.x1}
                y1={tick.y1}
                x2={tick.x2}
                y2={tick.y2}
                stroke={tick.isMajor ? '#64748B' : '#334155'}
                strokeWidth={tick.isMajor ? 2 : 1}
              />
            ))}

            {/* Dial Minute Numbers (Starting from 5 at top) */}
            {minuteNumbers.map((item, index) => (
              <text
                key={index}
                x={item.x}
                y={item.y}
                textAnchor="middle"
                fill="#FFFFFF"
                fontSize="15"
                fontWeight="800"
              >
                {item.val}
              </text>
            ))}
          </svg>

          {/* Center Digital Display Overlay */}
          <Box
            sx={{
              position: 'absolute',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <Typography
              sx={{
                fontSize: { xs: '1.75rem', sm: '2.25rem' },
                fontWeight: 900,
                color: '#FFFFFF',
                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                letterSpacing: '1px',
                lineHeight: 1,
                mb: 0.8,
              }}
            >
              {formatted}
            </Typography>
            <Typography
              sx={{
                fontSize: { xs: '0.6rem', sm: '0.7rem' },
                fontWeight: 700,
                color: '#94A3B8',
                letterSpacing: '2.5px',
                textTransform: 'uppercase',
              }}
            >
              {subLabel}
            </Typography>
          </Box>
        </Box>

        {/* Warning Indicator */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            mt: 2.5,
            mb: { xs: 2.5, sm: 3 },
          }}
        >
          <AccessTimeIcon sx={{ fontSize: 22, color: '#0099FF' }} />
          <Typography
            variant="body2"
            sx={{
              fontWeight: 700,
              fontSize: { xs: '0.85rem', sm: '0.95rem' },
              color: '#0A1C36',
            }}
          >
            Session will expire soon
          </Typography>
        </Box>

        {/* STAY SIGNED IN Action Button */}
        <Button
          fullWidth
          variant="contained"
          onClick={onStaySignedIn}
          disabled={isLoading}
          startIcon={
            isLoading ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              <TimerIcon sx={{ fontSize: 24, color: '#FFD700' }} />
            )
          }
          sx={{
            py: { xs: 1.25, sm: 1.5 },
            px: 3,
            borderRadius: '10px',
            backgroundColor: '#0A1C36',
            color: '#FFFFFF',
            fontSize: { xs: '0.95rem', sm: '1.05rem' },
            fontWeight: 800,
            letterSpacing: '1.2px',
            textTransform: 'uppercase',
            boxShadow: '0 6px 18px rgba(10, 28, 54, 0.4)',
            '&:hover': {
              backgroundColor: '#143261',
              boxShadow: '0 8px 22px rgba(10, 28, 54, 0.5)',
            },
          }}
        >
          {isLoading ? 'RENEWING...' : 'STAY SIGNED IN'}
        </Button>

        <Button
          fullWidth
          variant="outlined"
          onClick={onSignOut}
          disabled={isLoading}
          sx={{
            mt: 1.5,
            py: { xs: 1.1, sm: 1.25 },
            borderRadius: '10px',
            borderColor: '#CBD5E1',
            color: '#0A1C36',
            fontSize: { xs: '0.9rem', sm: '1rem' },
            fontWeight: 700,
            letterSpacing: '1px',
            textTransform: 'uppercase',
            '&:hover': {
              borderColor: '#94A3B8',
              backgroundColor: '#F8FAFC',
            },
          }}
        >
          SIGN OUT
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default SessionTimeoutModal;
