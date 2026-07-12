import { ref } from 'vue';

export class Notifier {
    readonly version = ref(0);

    notify(): void {
        this.version.value++;
    }

    /** 在 computed / watch 中调用以声明 reactive 依赖。 */
    listen(): number {
        return this.version.value;
    }
}
