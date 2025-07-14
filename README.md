# Assembly Web Application - Complete C Compilation & Debugging Environment

## Overview

This is a sophisticated web-based C compiler, disassembler, and CPU emulator that runs entirely in the browser. It provides a complete development environment for learning and debugging C programs, with real-time visualization of the compilation process, assembly generation, and CPU execution.

## 🌟 Key Features

### **Complete C Development Pipeline**
- **C Code Editor**: Syntax highlighting, auto-completion, bracket matching
- **Real-time Compilation**: Instant C to machine code compilation
- **Assembly Visualization**: Live disassembly with instruction-by-instruction breakdown
- **CPU Emulation**: Full x86_64 processor emulation with register and memory visualization
- **Step-by-Step Debugging**: Execute code instruction by instruction with complete state inspection

### **Advanced Function Call Support**
- **Multi-Function Programs**: Handles complex programs with multiple functions and function calls
- **Dynamic Call Fixing**: Automatically corrects TinyCC's function call target issues
- **Loop Support**: Proper handling of functions with loops, conditionals, and nested structures
- **Recursion Detection**: Distinguishes between legitimate and false recursion

### **Enhanced Debugging Experience**
- **Multi-Color Function Highlighting**: Each C function gets a unique color for easy visual distinction
- **Complete Function Highlighting**: Functions with loops and conditionals are highlighted completely
- **Real-time Correspondence**: See exactly which C code corresponds to which assembly instructions
- **Memory and Stack Visualization**: Full CPU state inspection including registers, memory, and stack

### **Comprehensive Testing Framework**
- **50+ Test Cases**: Covering all C language features and edge cases
- **Categorical Testing**: Organized into Unit, Integration, Performance, and Advanced test categories
- **Automated Validation**: Automatic result comparison and timeout handling
- **Custom Test Support**: Add your own test cases and expected results

## 🏗️ Architecture Overview

### **Core Technologies**

#### **Compilation Layer**
- **TinyCC (WebAssembly)**: Ultra-fast C compiler (679KB) with x86_64 ELF output
- **Custom ELF Parser**: Extracts machine code from compiled object files
- **Symbol Management**: Handles function symbols and relocations

#### **Analysis & Emulation Layer**
- **Capstone Engine**: Industry-standard disassembly framework
- **Unicorn Engine**: Full-featured CPU emulator based on QEMU
- **Dynamic Call Fixing**: Custom system for correcting function call targets

#### **User Interface Layer**
- **CodeMirror**: Professional code editor with C syntax highlighting
- **Responsive Design**: Three-column layout optimized for debugging
- **Real-time Updates**: Live assembly and CPU state visualization

### **File Structure & Framework Responsibilities**

```
assembly_web_app_3/
├── app/
│   ├── index.html              # Main application interface & C function highlighting
│   ├── demo.js                 # UI components (registers, memory, instructions)
│   ├── demo.css                # Styling & multi-color highlighting classes
│   ├── demo-x86.js             # x86-specific register definitions
│   ├── raw-code-loader.js      # Dynamic call fixing & function boundary detection
│   ├── tcc-wrapper/
│   │   └── compile_c_to_hex.c  # TinyCC WebAssembly wrapper & ELF parser
│   ├── build-tcc/              # TinyCC WebAssembly build
│   │   ├── tcc.js              # TinyCC JavaScript interface
│   │   ├── tcc.wasm            # TinyCC WebAssembly binary
│   │   └── tcc.data            # TinyCC data files
│   └── externals/              # Third-party WebAssembly modules
│       ├── unicorn-x86.min.js  # CPU emulator
│       ├── capstone-x86.min.js # Disassembler
│       ├── keystone-x86.min.js # Assembler
│       └── [other libraries]
├── ARCHITECTURE.md             # Detailed technical architecture
├── FRAMEWORK_EXTENSIONS.md     # Custom extensions & modifications
└── CLAUDE.md                   # Development guidelines & current state
```

## 🔧 Framework Details & Modifications

### **TinyCC Integration** (`tcc-wrapper/compile_c_to_hex.c`)
**Base Framework**: TinyCC 0.9.28rc compiled to WebAssembly  
**Custom Extensions**:
- **ELF64 Parser**: Manual ELF section parsing (standard libraries unavailable in WebAssembly)
- **Machine Code Extraction**: Direct .text section extraction from compiled objects
- **Symbol Table Processing**: Custom symbol and relocation handling
- **Memory Management**: Emscripten-compatible heap allocation

### **Dynamic Call Fixing System** (`raw-code-loader.js`)
**Purpose**: Fixes TinyCC's incorrect function call generation  
**Custom Implementation**:
- **Function Boundary Detection**: x86_64 prologue pattern recognition (0x55, 0x48 0x89 0xe5)
- **C Code Analysis**: Parses source code to understand function relationships
- **Call Target Correction**: Dynamically patches e8 (call) instruction offsets
- **Recursion Analysis**: Distinguishes legitimate vs. false recursion
- **Memory Consistency**: Ensures all modifications are reflected in emulator memory

### **Enhanced Function Highlighting** (`index.html`)
**Base Framework**: CodeMirror 5.65.15  
**Custom Extensions**:
- **Advanced Brace Matching**: Proper nesting level tracking for complete function highlighting
- **Multi-Color System**: Position-based color assignment (5-color palette)
- **Intelligent Caching**: Function color consistency throughout execution
- **Performance Optimization**: Efficient cleanup and color management

### **UI Components** (`demo.js`)
**Purpose**: Core debugging interface components  
**Components**:
- **Register Class**: CPU register visualization with interactive editing
- **Instruction Class**: Assembly instruction display with address mapping
- **Memory Viewer**: Hex and ASCII memory visualization
- **Emulation Controls**: Step execution and state management

### **Styling System** (`demo.css`)
**Features**:
- **Multi-Color Highlighting**: 5 distinct colors for C function visualization
- **Retro Terminal Theme**: Dark mode with professional styling
- **Responsive Layout**: Optimized for debugging workflow
- **Interactive Elements**: Hover effects and visual feedback

## 🚀 Getting Started

### **Prerequisites**
- Modern web browser with WebAssembly support (Chrome, Firefox, Safari, Edge)
- Python 3.x (for local development server)
- ✅ **No internet connection required** - completely offline application!

## 📦 Deployment Options

### **Option 1: Direct Download/Clone (Recommended)**

#### **For Git Users:**
```bash
# Clone the repository
git clone [repository-url]
cd assembly_web_app_3

# Start the server
cd app
python3 serve.py
```

#### **For Direct Download:**
1. Download the complete project folder
2. Extract to your desired location
3. Navigate to the `app` directory
4. Run `python3 serve.py`

### **Option 2: Alternative Server Methods**

#### **Using Python's Built-in Server:**
```bash
cd assembly_web_app_3/app
python3 -m http.server 8006
```

#### **Using Node.js (if available):**
```bash
cd assembly_web_app_3/app
npx serve -p 8006
```

#### **Using PHP (if available):**
```bash
cd assembly_web_app_3/app
php -S localhost:8006
```

### **Running the Application**

1. **Start the server** using any method above
2. **Open your browser** to `http://localhost:8006` (or the port you specified)
3. **The application loads automatically** - no additional setup required!

## 🌐 Browser Requirements

### **Supported Browsers:**
- ✅ **Chrome 57+** (Recommended)
- ✅ **Firefox 52+** 
- ✅ **Safari 11+**
- ✅ **Edge 16+**

### **Required Browser Features:**
- WebAssembly support
- ES6 JavaScript support
- Local storage access
- WebGL (for optimal performance)

## 🔧 Deployment on Different Computers

### **✅ Complete Offline Application**

This application is **completely self-contained** and works offline! All CodeMirror files are included locally, so no internet connection is needed after the initial download.

### **Network Deployment**

#### **Local Network Access:**
```bash
# Allow access from other computers on network
python3 -c "
import http.server
import socketserver
httpd = socketserver.TCPServer(('0.0.0.0', 8006), http.server.SimpleHTTPRequestHandler)
httpd.serve_forever()
"
```

Then access via `http://[your-ip]:8006` from other computers.

#### **Cloud Deployment (Nginx/Apache):**
Simply copy the `app/` directory to your web server's document root.

## 🚨 Troubleshooting

### **Common Issues:**

#### **Port Already in Use:**
```bash
# Try a different port
python3 -m http.server 8007
```

#### **Permission Denied:**
```bash
# On some systems, try:
python serve.py
# or
python3.x serve.py  # where x is your Python version
```

#### **Browser Compatibility:**
- Ensure JavaScript is enabled
- Try incognito/private mode
- Clear browser cache and cookies
- Update to latest browser version

#### **WebAssembly Issues:**
- Check browser console for error messages
- Ensure all files are properly downloaded
- All resources are local - no internet connection needed

### **Performance Optimization:**

#### **For Slower Computers:**
- Use Chrome for best performance
- Close other browser tabs
- Ensure sufficient RAM (4GB+ recommended)

#### **For Offline Usage:**
- ✅ Already completely offline - no setup needed!
- All resources are bundled locally

### **Basic Usage**
1. **Write C Code**: Enter your C program in the left editor
2. **Compile**: Click "Compile" to generate machine code
3. **Debug**: Use step-by-step execution to watch your program run
4. **Analyze**: Observe register changes, memory updates, and function highlighting

### **Example C Programs**

#### **Simple Function Call**
```c
int add(int a, int b) {
    return a + b;
}

int main() {
    int result = add(5, 3);
    return result;
}
```

#### **Function with Loop**
```c
int factorial(int n) {
    int result = 1;
    for(int i = 1; i <= n; i++) {
        result *= i;
    }
    return result;
}

int main() {
    return factorial(5);
}
```

## 🧪 Testing Framework

### **Test Categories**
- **Unit Tests**: Basic C constructs and simple functions
- **Integration Tests**: Multi-function programs and complex interactions
- **Performance Tests**: Efficiency and execution speed validation
- **Advanced Tests**: Complex algorithms and edge cases
- **Function Call Tests**: Multi-function scenarios with loops and recursion

### **Running Tests**
1. Select a test category from the dropdown
2. Click "Run All Tests in Category"
3. View results in real-time with pass/fail indicators
4. Analyze failed tests with detailed error messages

### **Adding Custom Tests**
1. Enter your C code in the editor
2. Click "Test Current Code" to execute and get the result
3. Enter the expected result and click "Add Test" to save it

## 🎨 Visual Debugging Features

### **Multi-Color Function Highlighting**
- **Blue**: `main()` function (always)
- **Green**: First non-main function
- **Orange**: Second non-main function
- **Purple**: Third non-main function
- **Red**: Fourth non-main function (cycles for more functions)

### **Real-time Correspondence**
- **Assembly Instructions**: Highlighted current instruction
- **C Code**: Entire active function highlighted with unique color
- **CPU State**: Live register and memory updates
- **Call Stack**: Visual representation of function calls

## 🔍 Debugging Capabilities

### **Step-by-Step Execution**
- Execute one assembly instruction at a time
- See exactly how C code translates to machine code
- Watch register values change in real-time
- Observe memory and stack modifications

### **CPU State Inspection**
- **Registers**: All x86_64 registers with hex and decimal values
- **Memory**: Hex dump with ASCII representation
- **Stack**: Stack pointer and stack contents visualization
- **Flags**: CPU flags and status indicators

### **Advanced Analysis**
- **Function Boundary Detection**: Automatic function identification
- **Call Target Analysis**: Function call relationship mapping
- **Recursion Detection**: Legitimate vs. false recursion identification
- **Performance Metrics**: Execution timing and instruction counts

## 🚨 Known Limitations

### **Language Support**
- **C Only**: Currently supports C language only (no C++)
- **Standard Library**: Limited standard library functions
- **Floating Point**: Basic floating point support

### **Architecture Support**
- **x86_64 Only**: Currently supports x86_64 architecture only
- **Linux ELF**: Generates Linux-compatible ELF object files

### **Performance Considerations**
- **Large Programs**: Very large programs may impact browser performance
- **Memory Usage**: Complex programs can consume significant memory
- **Compilation Speed**: While fast, very complex code may take longer

## 📚 Educational Value

This application is designed for:
- **Computer Science Students**: Learn how C code becomes machine code
- **Assembly Language Learning**: Understand x86_64 instruction set
- **Compiler Design**: See the complete compilation pipeline
- **Debugging Techniques**: Learn step-by-step debugging methods
- **CPU Architecture**: Understand how processors execute code

## 🔧 Technical Implementation Details

For detailed technical information, see:
- **ARCHITECTURE.md**: Complete technical architecture documentation
- **FRAMEWORK_EXTENSIONS.md**: Custom extensions and modifications
- **CLAUDE.md**: Development guidelines and current system state

## 🐛 Troubleshooting

### **Common Issues**
1. **Compilation Errors**: Check C syntax and supported features
2. **Step Execution Stopped**: Program may have completed or encountered an error
3. **Function Highlighting Issues**: Ensure proper brace matching in C code
4. **Performance Problems**: Try with smaller programs first

### **Debug Console**
Open browser developer tools to see detailed debug output with emoji-prefixed categories:
- 🔧 **Compilation**: TinyCC compilation process
- 🎯 **Call Fixing**: Function call target correction
- 🔍 **Analysis**: Function boundary detection
- 🎨 **Highlighting**: Color assignment and highlighting

## 🤝 Contributing

This project demonstrates advanced WebAssembly integration and custom framework extensions. The codebase is designed to be educational and extensible.

### **Key Innovation Areas**
1. **Dynamic Call Fixing**: Novel solution to TinyCC function call issues
2. **Advanced Highlighting**: Multi-color function visualization
3. **Educational Integration**: Complete pipeline visibility
4. **Performance Optimization**: Efficient WebAssembly utilization

## 📄 License

This project combines multiple open-source technologies:
- **TinyCC**: LGPL License
- **Unicorn Engine**: GPL License  
- **Capstone Engine**: BSD License
- **CodeMirror**: MIT License
- **Custom Extensions**: MIT License

---

*This application represents a significant advancement in web-based development environments, demonstrating how modern browser technologies can create sophisticated educational and debugging tools that rival traditional desktop applications.*# tcc_cap_unicorn
