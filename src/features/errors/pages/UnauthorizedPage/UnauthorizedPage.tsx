import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Stack, Typography } from '@mui/material';

export const UnauthorizedPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Box
      component="main"
      sx={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        px: 3,
        py: 4,
      }}
    >
      <Stack
        spacing={2}
        alignItems="center"
        sx={{ maxWidth: 480, textAlign: 'center' }}
      >
        <Typography variant="h4" component="h1" sx={{ fontWeight: 600, fontSize: '1.75rem' }}>
          Access Restricted
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ fontSize: '1rem' }}>
          You do not have permission to access this page.
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ fontSize: '1rem', mb: 1 }}>
          Please contact your department administrator for assistance.
        </Typography>
        <Button
          variant="contained"
          size="small"
          onClick={() => navigate(-1)}
          sx={{
            px: 2.5,
            py: 1,
            fontSize: '1rem',
            borderRadius: 1.5,
          }}
        >
          Go back
        </Button>
      </Stack>
    </Box>
  );
};
