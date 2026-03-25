export interface CartItem {
    name: string;
    price: string;
    quantity: string;
}
export declare function viewCart(): Promise<void>;
