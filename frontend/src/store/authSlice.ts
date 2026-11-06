import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { request } from '../services/api'

export type AppRole = 'admin' | 'pathologist' | 'frontdesk' | 'doctor' | 'patient'

export type AuthUser = {
  id: string
  displayName: string
  role: AppRole
  doctorId?: number
}

type AuthState = {
  user: AuthUser | null
  status: 'checking' | 'authenticated' | 'unauthenticated'
}

const initialState: AuthState = {
  user: null,
  status: 'checking',
}

export const restoreAuth = createAsyncThunk('auth/restore', async () => {
  const result = await request<{ user: AuthUser | null }>('/api/auth/session')
  return result.user
})

export const loginDemoStaff = createAsyncThunk('auth/loginDemoStaff', async (accountId: string) => {
  return request<AuthUser>('/api/auth/demo-staff', {
    method: 'POST',
    body: JSON.stringify({ accountId }),
  })
})

export const verifyPatientOtp = createAsyncThunk(
  'auth/verifyPatientOtp',
  async ({ mobile, code }: { mobile: string; code: string }) => {
    await request('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ mobile, code }),
    })
    return { id: 'patient', displayName: 'Patient', role: 'patient' as const }
  },
)

export const logout = createAsyncThunk('auth/logout', async () => {
  await request('/api/auth/logout', { method: 'POST' })
  return null
})

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(restoreAuth.pending, (state) => {
        state.status = 'checking'
      })
      .addCase(restoreAuth.fulfilled, (state, action) => {
        state.user = action.payload
        state.status = action.payload ? 'authenticated' : 'unauthenticated'
      })
      .addCase(restoreAuth.rejected, (state) => {
        state.user = null
        state.status = 'unauthenticated'
      })
      .addCase(loginDemoStaff.pending, (state) => {
        state.status = 'checking'
      })
      .addCase(loginDemoStaff.fulfilled, (state, action) => {
        state.user = action.payload
        state.status = 'authenticated'
      })
      .addCase(loginDemoStaff.rejected, (state) => {
        state.user = null
        state.status = 'unauthenticated'
      })
      .addCase(verifyPatientOtp.pending, (state) => {
        state.status = 'checking'
      })
      .addCase(verifyPatientOtp.fulfilled, (state, action) => {
        state.user = action.payload
        state.status = 'authenticated'
      })
      .addCase(verifyPatientOtp.rejected, (state) => {
        state.status = state.user ? 'authenticated' : 'unauthenticated'
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null
        state.status = 'unauthenticated'
      })
  },
})

export default authSlice.reducer
