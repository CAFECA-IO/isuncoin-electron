package main

import (
	"fmt"

	"github.com/urfave/cli/v2"
)

var flopsCommand = &cli.Command{
	Name:  "flops",
	Usage: "Calculate FLOPs",
	Action: func(c *cli.Context) error {
		fmt.Println("0.0 TFLOPS (Container Patch)")
		return nil
	},
}
