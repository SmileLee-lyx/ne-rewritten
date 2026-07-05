<script setup lang="ts">
import { computed } from 'vue';
import katex from 'katex';
import 'katex/dist/katex.min.css';

const props = defineProps<{ latex: string }>();

const html = computed(() => {
    try {
        return katex.renderToString(props.latex, { throwOnError: false, displayMode: false });
    } catch {
        return props.latex;
    }
});
</script>

<template>
    <span class="render-latex" v-html="html"></span>
</template>

<style scoped>
.render-latex :deep(.katex) {
    font-size: 1.1em;
}
</style>
