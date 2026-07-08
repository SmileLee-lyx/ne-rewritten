<script setup lang="ts" generic="T">
import type { TreeNode } from '@/core/tree.ts';
import NotationTreeItem from '@/components/NotationTreeItem.vue';
import { NotationDefinition } from '@/notation-definition.ts';

defineProps<{
    root: TreeNode<T>;
    notation: NotationDefinition<T>;
    tier?: number;
}>();
</script>

<template>
    <ul class="nowrap">
        <NotationTreeItem
            v-for="child in root.children"
            :key="child.path ?? child.index"
            :node="child"
            :notation="notation"
            :tier="tier"
        />
    </ul>
</template>
