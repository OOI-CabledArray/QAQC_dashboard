<script lang="ts" setup>
import { upperFirst } from 'lodash-es'

type User = {
  id: string
  email: string
  name: string
  role: 'admin' | 'viewer'
  created_at: string
  updated_at: string
}

const toast = useToast()

let users = $ref<User[]>([])
let loading = $ref(true)
let showCreateDialog = $ref(false)
let editingUser = $ref<User | null>(null)
let changingPasswordUser = $ref<User | null>(null)
let deletingUser = $ref<User | null>(null)

let createForm = $ref({ email: '', name: '', password: '', role: 'viewer' as string })
let editForm = $ref({ email: '', name: '', role: 'viewer' as string })
let passwordForm = $ref({ password: '' })
let submitting = $ref(false)

async function loadUsers() {
  try {
    users = await $fetch('/api/users')
  } catch {
    users = []
    toast.add({ title: 'Failed to load users.', color: 'error' })
  } finally {
    loading = false
  }
}

function openCreate() {
  createForm = { email: '', name: '', password: '', role: 'viewer' }
  showCreateDialog = true
}

function openEdit(user: User) {
  editForm = { email: user.email, name: user.name, role: user.role }
  editingUser = user
}

function openChangePassword(user: User) {
  passwordForm = { password: '' }
  changingPasswordUser = user
}

async function createUser() {
  submitting = true
  try {
    await $fetch('/api/users', {
      method: 'POST',
      body: createForm,
    })
    showCreateDialog = false
    toast.add({ title: `Created user ${createForm.name}.`, color: 'success' })
    await loadUsers()
  } catch (error: any) {
    toast.add({
      title: error.data?.statusMessage || 'Failed to create user.',
      color: 'error',
    })
  } finally {
    submitting = false
  }
}

async function updateUser() {
  if (!editingUser) {
    return
  }
  submitting = true
  try {
    await $fetch(`/api/users/${editingUser.id}`, {
      method: 'PATCH',
      body: editForm,
    })
    editingUser = null
    toast.add({ title: `Updated user ${editForm.name}.`, color: 'success' })
    await loadUsers()
  } catch (error: any) {
    toast.add({
      title: error.data?.statusMessage || 'Failed to update user.',
      color: 'error',
    })
  } finally {
    submitting = false
  }
}

async function changePassword() {
  if (!changingPasswordUser) {
    return
  }
  submitting = true
  try {
    await $fetch(`/api/users/${changingPasswordUser.id}/password`, {
      method: 'PUT',
      body: passwordForm,
    })
    toast.add({
      title: `Password changed for ${changingPasswordUser.name}.`,
      color: 'success',
    })
    changingPasswordUser = null
  } catch (error: any) {
    toast.add({
      title: error.data?.statusMessage || 'Failed to change password.',
      color: 'error',
    })
  } finally {
    submitting = false
  }
}

async function deleteUser() {
  if (!deletingUser) {
    return
  }
  submitting = true
  try {
    await $fetch(`/api/users/${deletingUser.id}`, { method: 'DELETE' })
    toast.add({ title: `Deleted user ${deletingUser.name}.`, color: 'success' })
    deletingUser = null
    await loadUsers()
  } catch (error: any) {
    toast.add({
      title: error.data?.statusMessage || 'Failed to delete user.',
      color: 'error',
    })
  } finally {
    submitting = false
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString + 'Z').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

if (import.meta.client) {
  loadUsers()
}
</script>

<template>
  <div class="max-w-4xl mx-auto p-3 sm:p-6">
    <div class="flex items-center justify-between mb-6">
      <h1 class="font-bold text-2xl">Users</h1>
      <u-button @click="openCreate">
        <i class="fa-plus fas mr-1" />
        Create User
      </u-button>
    </div>

    <div v-if="loading" class="py-12 text-center text-gray-500">Loading...</div>

    <div v-else class="sm:hidden space-y-3">
      <div v-for="user in users" :key="user.id" class="border p-3 rounded-lg">
        <div class="flex items-center justify-between mb-1">
          <span class="font-medium text-sm">{{ user.name }}</span>
          <u-badge :color="user.role === 'admin' ? 'primary' : 'neutral'" variant="subtle">
            {{ upperFirst(user.role) }}
          </u-badge>
        </div>
        <div class="mb-2 text-gray-500 text-xs">{{ user.email }}</div>
        <div class="flex gap-1">
          <u-tooltip text="Edit">
            <u-button size="xs" variant="ghost" @click="openEdit(user)">
              <i class="fa-pen fas" />
            </u-button>
          </u-tooltip>
          <u-tooltip text="Change Password">
            <u-button size="xs" variant="ghost" @click="openChangePassword(user)">
              <i class="fa-key fas" />
            </u-button>
          </u-tooltip>
          <u-tooltip text="Delete">
            <u-button
              class="hover:text-[var(--ui-error)] text-gray-500"
              size="xs"
              variant="ghost"
              @click="deletingUser = user"
            >
              <i class="fa-trash fas" />
            </u-button>
          </u-tooltip>
        </div>
      </div>
    </div>

    <div v-if="!loading" class="max-sm:hidden min-w-0 overflow-x-auto">
      <u-table
        :columns="[
          { accessorKey: 'name', header: 'Name' },
          { accessorKey: 'email', header: 'Email' },
          { accessorKey: 'role', header: 'Role' },
          { accessorKey: 'created_at', header: 'Created' },
          { accessorKey: 'actions', header: '' },
        ]"
        :data="users"
      >
        <template #role-cell="{ row }">
          <u-badge :color="row.original.role === 'admin' ? 'primary' : 'neutral'" variant="subtle">
            {{ upperFirst(row.original.role) }}
          </u-badge>
        </template>
        <template #created_at-cell="{ row }">
          {{ formatDate(row.original.created_at) }}
        </template>
        <template #actions-cell="{ row }">
          <div class="flex gap-1 justify-end">
            <u-tooltip text="Edit">
              <u-button size="xs" variant="ghost" @click="openEdit(row.original)">
                <i class="fa-pen fas" />
              </u-button>
            </u-tooltip>
            <u-tooltip text="Change Password">
              <u-button size="xs" variant="ghost" @click="openChangePassword(row.original)">
                <i class="fa-key fas" />
              </u-button>
            </u-tooltip>
            <u-tooltip text="Delete">
              <u-button
                class="hover:text-[var(--ui-error)] text-gray-500"
                size="xs"
                variant="ghost"
                @click="deletingUser = row.original"
              >
                <i class="fa-trash fas" />
              </u-button>
            </u-tooltip>
          </div>
        </template>
      </u-table>
    </div>

    <!-- Create User Dialog -->
    <u-modal v-model:open="showCreateDialog">
      <template #header>
        <span class="font-semibold">Create User</span>
      </template>
      <template #body>
        <form class="space-y-4" @submit.prevent="createUser">
          <div>
            <label class="block font-medium mb-1 text-sm">Name</label>
            <u-input v-model="createForm.name" class="w-full" required />
          </div>
          <div>
            <label class="block font-medium mb-1 text-sm">Email</label>
            <u-input v-model="createForm.email" class="w-full" required type="email" />
          </div>
          <div>
            <label class="block font-medium mb-1 text-sm">Password</label>
            <u-input v-model="createForm.password" class="w-full" required type="password" />
          </div>
          <div>
            <label class="block font-medium mb-1 text-sm">Role</label>
            <u-select-menu
              v-model="createForm.role"
              class="w-full"
              :items="[
                { label: 'Viewer', value: 'viewer' },
                { label: 'Admin', value: 'admin' },
              ]"
              value-key="value"
            />
          </div>
          <div class="flex gap-2 justify-end">
            <u-button variant="ghost" @click="showCreateDialog = false">Cancel</u-button>
            <u-button :loading="submitting" type="submit">Create</u-button>
          </div>
        </form>
      </template>
    </u-modal>

    <!-- Edit User Dialog -->
    <u-modal :open="!!editingUser" @update:open="editingUser = null">
      <template #header>
        <span class="font-semibold">Edit User</span>
      </template>
      <template #body>
        <form class="space-y-4" @submit.prevent="updateUser">
          <div>
            <label class="block font-medium mb-1 text-sm">Name</label>
            <u-input v-model="editForm.name" class="w-full" required />
          </div>
          <div>
            <label class="block font-medium mb-1 text-sm">Email</label>
            <u-input v-model="editForm.email" class="w-full" required type="email" />
          </div>
          <div>
            <label class="block font-medium mb-1 text-sm">Role</label>
            <u-select-menu
              v-model="editForm.role"
              class="w-full"
              :items="[
                { label: 'Viewer', value: 'viewer' },
                { label: 'Admin', value: 'admin' },
              ]"
              value-key="value"
            />
          </div>
          <div class="flex gap-2 justify-end">
            <u-button variant="ghost" @click="editingUser = null">Cancel</u-button>
            <u-button :loading="submitting" type="submit">Save</u-button>
          </div>
        </form>
      </template>
    </u-modal>

    <!-- Change Password Dialog -->
    <u-modal :open="!!changingPasswordUser" @update:open="changingPasswordUser = null">
      <template #header>
        <span class="font-semibold"> Change Password for {{ changingPasswordUser?.name }} </span>
      </template>
      <template #body>
        <form class="space-y-4" @submit.prevent="changePassword">
          <div>
            <label class="block font-medium mb-1 text-sm">New Password</label>
            <u-input v-model="passwordForm.password" class="w-full" required type="password" />
          </div>
          <div class="flex gap-2 justify-end">
            <u-button variant="ghost" @click="changingPasswordUser = null">Cancel</u-button>
            <u-button :loading="submitting" type="submit">Change Password</u-button>
          </div>
        </form>
      </template>
    </u-modal>

    <!-- Delete Confirmation Dialog -->
    <u-modal :open="!!deletingUser" @update:open="deletingUser = null">
      <template #header>
        <span class="font-semibold">Delete User</span>
      </template>
      <template #body>
        <p class="mb-4 text-sm">
          Are you sure you want to delete <strong>{{ deletingUser?.name }}</strong
          >? This cannot be undone.
        </p>
        <div class="flex gap-2 justify-end">
          <u-button variant="ghost" @click="deletingUser = null">Cancel</u-button>
          <u-button color="red" :loading="submitting" @click="deleteUser">Delete</u-button>
        </div>
      </template>
    </u-modal>
  </div>
</template>
