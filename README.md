# Interactive DRAM Hierarchy & Address Mapping Visualizer

An advanced web-based tool designed to configure, visualize, and analyze complex DRAM memory architectures and address mapping schemes. This application provides an interactive drill-down interface to explore the DRAM hierarchy, alongside powerful tools for decoding physical addresses and verifying configuration consistency.

It is built to help hardware architects, system software engineers, researchers, and students to intuitively understand how physical addresses map to different levels of the DRAM hierarchy (Channel, Rank, Bank, etc.) and how memory is partitioned among multiple Virtual Machines (VMs).

---

## Key Features

* **Hierarchical Configuration**: Interactively set the size (number of elements) for each level of the DRAM hierarchy: Channel, Rank, Bank, BankGroup, Subarray, Row, and Column.
* **Flexible Address Mapping**: Define the physical address bits that map to each hierarchy level's ID. Supports both direct mapping (e.g., `5`) and XOR mapping (e.g., `5,12,17`).
* **Interactive Drill-Down Visualizer**: Navigate through the DRAM hierarchy by clicking on elements. The view dynamically updates to show the children of the selected element.
    * **Custom Layouts**: Subarrays and other high-level components are shown in a grid, Rows in a scrollable list, and Columns as a dense grid of pixels for clear visualization.
    * **Breadcrumb Navigation**: A breadcrumb trail (e.g., `System > Channel0 > Rank0`) shows your current location and allows for quick navigation to any parent level.
* **Virtual Machine (VM) Aware Coloring**:
    * Define multiple VMs with specific base addresses and sizes.
    * The visualizer automatically colors hierarchy elements based on which VM's address range utilizes them.
    * **Striped Coloring**: Elements used by multiple VMs are shown with a striped pattern of the corresponding VM colors.
    * **Column Exclusivity**: Columns, assumed to be used by a single VM, are shown with a special "conflict" color if an overlap is detected.
* **Live Analysis & Decoding**:
    * **Physical Address Decoder**: Input any physical address (in hex) to see its corresponding Channel, Rank, Bank, etc., IDs based on the current mapping configuration.
    * **Bit Count Consistency Check**: Automatically calculates the total bits required by the configured capacity and compares it against the sum of bits used in the address mapping, flagging any inconsistencies.

## Technology Stack

* **Framework**: [React](https://reactjs.org/) (with functional components and hooks)
* **Language**: [TypeScript](https://www.typescriptlang.org/)
* **UI Library**: [Material-UI (MUI)](https://mui.com/)
* **Icons**: [MUI Icons](https://mui.com/material-ui/material-icons/)

## Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

* docker

### Installation

1.  **Clone the repository:**
    ```sh
    git clone [https://github.com/h1demasa/DRAMVisualizer.git](https://github.com/h1demasa/DRAMVisualizer.git)
    cd DRAMVisualizer
    ```

2.  **Run the development server:**
    ```sh
    docker compose up
    ```
    The application will open automatically in your browser at `http://localhost:5173`.

## How to Use

The application is divided into three main panels: **Configuration** (left), **Visualizer** (center), and **Analysis & Info** (right).

1.  **System Configuration**:
    * **Total Capacity**: In the `System & VM` panel, define the total physical memory size of your system (e.g., `2GB`, `512MB`). This sets the bounds for address calculations.
    * **VM Configuration**: Specify the number of VMs. For each VM, enter its `Base Address` and `Size` in hexadecimal format (e.g., `0x10000000` and `0x1000` for 4KB).

2.  **Address Mapping Configuration**:
    * In the `DRAM Address Mapping` panel, configure the structure of your DRAM.
    * **Value**: Enter the number of elements for each hierarchy level (e.g., `4` for Bank). This will dynamically create the corresponding number of Nbit mapping fields.
    * **Bits (PA Bit Pos)**: For each `...bit` field, enter the physical address bit position(s) that determine that part of the ID.
        * For direct mapping, enter a single number (e.g., `5`).
        * For XOR mapping, enter numbers separated by commas (e.g., `6,14,22`).

3.  **Interact with the Visualizer**:
    * The central panel shows the top level of the hierarchy (Channels).
    * **Drill Down**: Click on any element (e.g., `Ch0`) to view its children (e.g., Ranks within Channel 0).
    * **Navigate Up**: Use the breadcrumbs at the top of the visualizer or the back arrow button to return to parent levels.
    * **VM Coloring**: As you configure VMs, the elements in the visualizer will be automatically colored to show which VM(s) utilize them.

4.  **Analyze Results**:
    * **Information Panel**: When you click an element in the visualizer, its details (ID, type, path) appear in the top-right panel.
    * **PA Decode**: In the bottom-right panel, enter any physical address to see its decoded hierarchy IDs based on your current mapping.
    * **Consistency Check**: This panel automatically compares the address bits required by the `Total Capacity` against the bits defined in your mapping, letting you know if they are consistent.

## License

This project is licensed under the MIT License - see the `LICENSE.md` file for details.