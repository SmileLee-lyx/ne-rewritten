<script setup lang="ts">
import RenderLatex from './RenderLatex.vue';

defineProps<{ latex: string }>();
</script>

<template>
    <div class="latex-wrapper">
        <RenderLatex :latex="latex" />
    </div>
</template>

<style scoped>
.latex-wrapper {
    padding: 4px 8px;
    min-width: 40px;
    min-height: 24px;
}
</style>
